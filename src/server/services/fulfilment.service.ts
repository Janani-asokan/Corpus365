import { and, eq } from "drizzle-orm";
import type { Tx } from "@/server/db/client";
import { first, single } from "@/server/db/query";
import { licenceKeys, orderItems, orders, plans, products, subscriptions, users, type Order, type Plan, type Product } from "@/server/db/schema";
import { addInterval } from "@/domain/pricing";
import { licenceKey } from "@/lib/random";
import { recordCommissions, type PaidLine } from "./commission.service";

/**
 * Delivers what an order paid for. Everything is read from the database, so
 * the same code serves instant payments, the browser confirmation and Razorpay
 * webhooks. Runs inside the transaction that marks the order paid.
 */
async function fulfilOrder(tx: Tx, order: Order, now: Date): Promise<void> {
  switch (order.kind) {
    case "retail":
      return fulfilRetail(tx, order, now);
    case "renewal":
      return fulfilRenewal(tx, order, now);
    case "partner_bulk":
      return fulfilBulk(tx, order);
  }
}

async function fulfilRetail(tx: Tx, order: Order, now: Date): Promise<void> {
  const items = await tx
    .select({ item: orderItems, product: products, plan: plans })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .leftJoin(plans, eq(plans.id, orderItems.planId))
    .where(eq(orderItems.orderId, order.id));

  const paidLines: PaidLine[] = [];
  for (const { item, product, plan } of items) {
    paidLines.push({
      orderItemId: item.id,
      productType: product.type,
      netAmount: item.lineTotal,
      hardwareMargin: product.hardwareMargin,
      description: item.description,
      subscriptionId:
        product.type === "app" && plan
          ? await activateSubscription(tx, { userId: order.userId, product, plan, partnerId: order.partnerId, now })
          : null,
    });
  }

  if (order.partnerId) {
    await recordCommissions(tx, { orderId: order.id, partnerId: order.partnerId, isRenewal: false, lines: paidLines, now });
  }
}

/** Converts a trial or lapsed subscription, extends an active one, or creates a new one. */
async function activateSubscription(
  tx: Tx,
  input: { userId: string; product: Product; plan: Plan; partnerId: string | null; now: Date },
): Promise<string> {
  // One row per (user, product) is a database invariant; lock it while we change it.
  const existing = await first(
    tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, input.userId), eq(subscriptions.productId, input.product.id)))
      .limit(1)
      .for("update"),
  );

  if (existing?.status === "active") {
    // Paid twice (e.g. two checkout tabs): honour the money with an extra period.
    await tx
      .update(subscriptions)
      .set({ currentPeriodEnd: addInterval(existing.currentPeriodEnd, input.plan.interval), planId: input.plan.id })
      .where(eq(subscriptions.id, existing.id));
    return existing.id;
  }

  const period = { currentPeriodStart: input.now, currentPeriodEnd: addInterval(input.now, input.plan.interval) };
  if (existing) {
    await tx
      .update(subscriptions)
      .set({ ...period, status: "active", planId: input.plan.id, partnerId: input.partnerId ?? existing.partnerId, cancelAtPeriodEnd: false })
      .where(eq(subscriptions.id, existing.id));
    return existing.id;
  }

  const created = await single(
    tx
      .insert(subscriptions)
      .values({ ...period, userId: input.userId, productId: input.product.id, planId: input.plan.id, partnerId: input.partnerId, status: "active", licenseKey: licenceKey(), createdAt: input.now })
      .returning({ id: subscriptions.id }),
  );
  return created.id;
}

async function fulfilRenewal(tx: Tx, order: Order, now: Date): Promise<void> {
  if (!order.subscriptionId) throw new Error(`Renewal order ${order.number} has no subscription`);
  const row = await first(
    tx
      .select({ subscription: subscriptions, plan: plans, product: products, user: users, item: orderItems })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .innerJoin(products, eq(products.id, subscriptions.productId))
      .innerJoin(users, eq(users.id, subscriptions.userId))
      .innerJoin(orderItems, eq(orderItems.orderId, order.id))
      .where(eq(subscriptions.id, order.subscriptionId))
      .limit(1)
      .for("update", { of: subscriptions }),
  );
  if (!row) throw new Error(`Subscription for renewal ${order.number} not found`);
  const { subscription, plan, product, user, item } = row;

  // An active subscription renews from its period end, so paying early or
  // within the grace period never loses or gains days. A lapsed one restarts now.
  const start = subscription.status === "active" ? subscription.currentPeriodEnd : now;
  await tx
    .update(subscriptions)
    .set({
      status: "active",
      currentPeriodStart: start,
      currentPeriodEnd: addInterval(start, plan.interval),
      renewalCount: subscription.renewalCount + 1,
      cancelAtPeriodEnd: false,
    })
    .where(eq(subscriptions.id, subscription.id));

  if (subscription.partnerId) {
    await recordCommissions(tx, {
      orderId: order.id,
      partnerId: subscription.partnerId,
      isRenewal: true,
      now,
      lines: [
        {
          orderItemId: item.id,
          productType: "app",
          netAmount: order.subtotal,
          hardwareMargin: null,
          description: `${product.name} renewal · ${user.companyName ?? user.name}`,
          subscriptionId: subscription.id,
        },
      ],
    });
  }
}

async function fulfilBulk(tx: Tx, order: Order): Promise<void> {
  const items = await tx
    .select({ item: orderItems, type: products.type })
    .from(orderItems)
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, order.id));

  for (const { item } of items.filter((i) => i.type === "app")) {
    await tx.insert(licenceKeys).values(
      Array.from({ length: item.quantity }, () => ({ key: licenceKey(), orderItemId: item.id, partnerId: order.userId, productId: item.productId })),
    );
  }
}

/**
 * Marks the order paid and fulfils it, exactly once. The order row is locked
 * (SELECT … FOR UPDATE), so a webhook and the browser confirmation arriving at
 * the same moment cannot both fulfil it.
 */
export async function markPaidAndFulfil(tx: Tx, orderId: string, paymentReference: string, now: Date): Promise<{ order: Order; newlyPaid: boolean }> {
  const order = await first(tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update"));
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.status === "paid") return { order, newlyPaid: false };

  // A "failed" order can still be paid late (e.g. a renewal link after the grace
  // period). Money received always wins: fulfil it.
  const paid = await single(tx.update(orders).set({ status: "paid", paidAt: now, paymentReference }).where(eq(orders.id, orderId)).returning());
  await fulfilOrder(tx, paid, now);
  return { order: paid, newlyPaid: true };
}
