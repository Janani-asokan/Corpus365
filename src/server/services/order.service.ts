import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, type Tx } from "@/server/db/client";
import { first, isUniqueViolation, single } from "@/server/db/query";
import {
  licenceKeys,
  orderItems,
  orders,
  plans,
  products,
  subscriptions,
  users,
  type Order,
  type OrderItem,
  type Plan,
  type Product,
  type Subscription,
} from "@/server/db/schema";
import { addDays, addInterval, computeTotals, unitPriceForQuantity } from "@/domain/pricing";
import type { OrderKind } from "@/domain/constants";
import { UserFacingError } from "@/lib/errors";
import { licenceKey } from "@/lib/random";
import { findApprovedPartnerByCode, getPartnerProfile } from "./partner.service";
import { isUuid, listPartnerCatalog } from "./catalog.service";
import { audit } from "./audit.service";
import { beginPayment, type Payer, type PaymentOutcome } from "./payment.service";

export type { PaymentOutcome };

/**
 * Order use cases. Each creates a pending order with server-side prices, then
 * hands it to the payment service; fulfilment happens once payment is confirmed
 * (instantly in test mode, after Razorpay checkout or webhook otherwise).
 */

const MAX_HARDWARE_QUANTITY = 50;
const MAX_BULK_QUANTITY = 1000;

export interface CartLine {
  productId: string;
  planId: string | null;
  quantity: number;
}

export interface PricedLine {
  product: Product;
  plan: Plan | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  description: string;
}

/* ------------------------------------------------------------------ pricing */

/**
 * Prices cart lines from the database. The cart cookie holds only ids and
 * quantities, so prices can never be tampered with client-side.
 */
export async function priceRetailLines(lines: readonly CartLine[]): Promise<PricedLine[]> {
  const valid = lines.filter((l) => isUuid(l.productId) && (l.planId === null || isUuid(l.planId)));
  if (valid.length === 0) return [];
  const productRows = await db.select().from(products).where(inArray(products.id, valid.map((l) => l.productId)));
  const planIds = valid.map((l) => l.planId).filter((id): id is string => Boolean(id));
  const planRows = planIds.length ? await db.select().from(plans).where(inArray(plans.id, planIds)) : [];

  const priced: PricedLine[] = [];
  for (const line of valid) {
    const product = productRows.find((p) => p.id === line.productId);
    if (!product || product.status !== "live") continue; // silently drop unavailable items

    if (product.type === "app") {
      const plan = planRows.find((p) => p.id === line.planId && p.productId === product.id);
      if (!plan) continue;
      priced.push({ product, plan, quantity: 1, unitPrice: plan.price, lineTotal: plan.price, description: `${product.name} · ${plan.name}` });
    } else if (product.unitPrice) {
      const quantity = Math.min(Math.max(1, Math.floor(line.quantity)), MAX_HARDWARE_QUANTITY);
      priced.push({ product, plan: null, quantity, unitPrice: product.unitPrice, lineTotal: product.unitPrice * quantity, description: product.name });
    }
  }
  return priced;
}

/* -------------------------------------------------------------- attribution */

/**
 * Decides which partner (if any) is credited. First touch wins and is then
 * fixed on the client's account, so clients cannot be "poached" later.
 * Partners can never be credited for their own purchases.
 */
async function resolveAttribution(tx: Tx, buyerId: string, codes: { entered?: string | null; cookie?: string | null }): Promise<string | null> {
  const buyer = await first(tx.select().from(users).where(eq(users.id, buyerId)).limit(1).for("update"));
  if (!buyer) throw new UserFacingError("Account not found.");

  if (buyer.referredByPartnerId) {
    const profile = await getPartnerProfile(buyer.referredByPartnerId, tx);
    return profile?.status === "approved" ? profile.userId : null;
  }

  const entered = codes.entered?.trim();
  if (entered) {
    const partner = await findApprovedPartnerByCode(entered, tx);
    if (!partner) throw new UserFacingError("That partner code is not valid. Check it with your partner or leave it blank.");
    return lockAttribution(tx, buyerId, partner.userId);
  }

  const fromCookie = codes.cookie ? await findApprovedPartnerByCode(codes.cookie, tx) : null;
  return fromCookie ? lockAttribution(tx, buyerId, fromCookie.userId) : null;
}

async function lockAttribution(tx: Tx, buyerId: string, partnerId: string): Promise<string | null> {
  if (partnerId === buyerId) return null;
  await tx.update(users).set({ referredByPartnerId: partnerId }).where(eq(users.id, buyerId));
  return partnerId;
}

/* ---------------------------------------------------------------- ordering */

interface NewOrderLine {
  productId: string;
  planId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** The order number comes from a database sequence, so concurrent checkouts never collide. */
async function createPendingOrder(
  tx: Tx,
  input: {
    userId: string;
    partnerId: string | null;
    kind: OrderKind;
    lines: NewOrderLine[];
    billing: { billingName: string; billingCompany?: string | null; billingGstin?: string | null };
    subscriptionId?: string | null;
    now: Date;
  },
): Promise<Order> {
  const totals = computeTotals(input.lines.map((l) => l.lineTotal));
  const order = await single(
    tx
      .insert(orders)
      .values({
        userId: input.userId,
        partnerId: input.partnerId,
        kind: input.kind,
        status: "pending",
        ...totals,
        billingName: input.billing.billingName,
        billingCompany: input.billing.billingCompany ?? null,
        billingGstin: input.billing.billingGstin ?? null,
        subscriptionId: input.subscriptionId ?? null,
        createdAt: input.now,
      })
      .returning(),
  );
  await tx.insert(orderItems).values(input.lines.map((line) => ({ ...line, orderId: order.id })));
  return order;
}

/* --------------------------------------------------------- retail checkout */

export async function checkout(input: {
  buyer: Payer;
  lines: readonly CartLine[];
  billing: { billingName: string; billingCompany?: string | null; billingGstin?: string | null };
  partnerCode?: string | null;
  referralCookie?: string | null;
  now?: Date;
}): Promise<PaymentOutcome> {
  const now = input.now ?? new Date();
  const priced = await priceRetailLines(input.lines);
  if (priced.length === 0) throw new UserFacingError("Your cart is empty or its items are no longer available.");

  const order = await db.transaction(async (tx) => {
    const appIds = priced.filter((l) => l.product.type === "app").map((l) => l.product.id);
    if (appIds.length) {
      const active = await first(
        tx
          .select({ productId: subscriptions.productId })
          .from(subscriptions)
          .where(and(eq(subscriptions.userId, input.buyer.id), inArray(subscriptions.productId, appIds), eq(subscriptions.status, "active")))
          .limit(1),
      );
      if (active) {
        const name = priced.find((l) => l.product.id === active.productId)!.product.name;
        throw new UserFacingError(`You already have an active ${name} subscription. Renew it from your account instead.`);
      }
    }

    const partnerId = await resolveAttribution(tx, input.buyer.id, { entered: input.partnerCode, cookie: input.referralCookie });
    return createPendingOrder(tx, {
      userId: input.buyer.id,
      partnerId,
      kind: "retail",
      billing: input.billing,
      now,
      lines: priced.map((l) => ({
        productId: l.product.id,
        planId: l.plan?.id ?? null,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
    });
  });

  return beginPayment(order, input.buyer, `Corpus365 order ${order.number}`, now);
}

/* ------------------------------------------------------------------ trials */

export async function startTrial(input: { userId: string; productId: string; referralCookie?: string | null; now?: Date }): Promise<Subscription> {
  const now = input.now ?? new Date();
  const product = await getProduct(input.productId);
  if (!product || product.type !== "app" || product.status !== "live" || !product.trialDays) {
    throw new UserFacingError("A free trial is not available for this product.");
  }
  const trialDays = product.trialDays;
  const alreadyUsed = new UserFacingError(`You have already used your ${product.name} trial. Choose a plan to continue.`);

  try {
    return await db.transaction(async (tx) => {
      const previous = await first(
        tx.select({ id: subscriptions.id }).from(subscriptions).where(and(eq(subscriptions.userId, input.userId), eq(subscriptions.productId, product.id))).limit(1),
      );
      if (previous) throw alreadyUsed;

      const partnerId = await resolveAttribution(tx, input.userId, { cookie: input.referralCookie });
      return single(
        tx
          .insert(subscriptions)
          .values({
            userId: input.userId,
            productId: product.id,
            planId: null,
            partnerId,
            status: "trialing",
            licenseKey: licenceKey(),
            currentPeriodStart: now,
            currentPeriodEnd: addDays(now, trialDays),
            createdAt: now,
          })
          .returning(),
      );
    });
  } catch (error) {
    // Two clicks at once: the (user, product) unique constraint lets only one through.
    if (isUniqueViolation(error, "subscriptions_user_product_key")) throw alreadyUsed;
    throw error;
  }
}

async function getProduct(productId: string): Promise<Product | undefined> {
  if (!isUuid(productId)) return undefined;
  return first(db.select().from(products).where(eq(products.id, productId)).limit(1));
}

/* ---------------------------------------------------------------- renewals */

/** Creates (but does not charge) the renewal order for a paid subscription. */
export async function createRenewalOrder(subscriptionId: string, now: Date, userId?: string): Promise<{ order: Order; payer: Payer; description: string }> {
  if (!isUuid(subscriptionId)) throw new UserFacingError("Subscription not found.");
  const row = await first(
    db
      .select({ subscription: subscriptions, plan: plans, product: products, user: users })
      .from(subscriptions)
      .innerJoin(products, eq(products.id, subscriptions.productId))
      .innerJoin(users, eq(users.id, subscriptions.userId))
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1),
  );

  if (!row || (userId && row.subscription.userId !== userId)) throw new UserFacingError("Subscription not found.");
  const { subscription, plan, product, user } = row;
  if (!plan || subscription.status === "trialing") throw new UserFacingError("Choose a plan to continue after your trial.");

  const description = `${product.name} · ${plan.name} renewal`;
  try {
    const order = await db.transaction((tx) =>
      createPendingOrder(tx, {
        userId: user.id,
        partnerId: subscription.partnerId,
        kind: "renewal",
        subscriptionId: subscription.id,
        billing: { billingName: user.name, billingCompany: user.companyName },
        now,
        lines: [{ productId: product.id, planId: plan.id, description, quantity: 1, unitPrice: plan.price, lineTotal: plan.price }],
      }),
    );
    return { order, payer: user, description };
  } catch (error) {
    if (isUniqueViolation(error, "orders_one_open_renewal_key")) {
      throw new UserFacingError("A renewal payment is already open for this subscription. Use the Pay now link on your Subscriptions page.");
    }
    throw error;
  }
}

/** Client-initiated renewal ("Renew now"): paid on-session through checkout. */
export async function renewSubscription(input: { subscriptionId: string; userId?: string; now?: Date }): Promise<PaymentOutcome> {
  const now = input.now ?? new Date();
  const { order, payer, description } = await createRenewalOrder(input.subscriptionId, now, input.userId);
  return beginPayment(order, payer, description, now);
}

/** The unpaid renewal order for a subscription, if one is open. */
export async function pendingRenewalOrder(subscriptionId: string): Promise<Order | null> {
  return (
    (await first(
      db
        .select()
        .from(orders)
        .where(and(eq(orders.subscriptionId, subscriptionId), eq(orders.kind, "renewal"), eq(orders.status, "pending")))
        .limit(1),
    )) ?? null
  );
}

export async function setCancelAtPeriodEnd(userId: string, subscriptionId: string, cancel: boolean): Promise<void> {
  if (!isUuid(subscriptionId)) throw new UserFacingError("Subscription not found.");
  const updated = await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: cancel })
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .returning({ id: subscriptions.id });
  if (updated.length === 0) throw new UserFacingError("Subscription not found or not active.");
}

/* ------------------------------------------------------ partner bulk orders */

export async function placePartnerBulkOrder(input: { partner: Payer; lines: { productId: string; quantity: number }[]; now?: Date }): Promise<PaymentOutcome> {
  const now = input.now ?? new Date();
  const profile = await getPartnerProfile(input.partner.id);
  if (profile?.status !== "approved") throw new UserFacingError("Bulk ordering opens once your partner account is approved.");

  const catalog = await listPartnerCatalog();
  const lines = input.lines
    .filter((l) => l.quantity > 0)
    .map((line) => {
      const item = catalog.find((c) => c.id === line.productId);
      if (!item) throw new UserFacingError("One of the selected products is not available for bulk ordering.");
      if (!Number.isInteger(line.quantity) || line.quantity < item.minQuantity || line.quantity > MAX_BULK_QUANTITY) {
        throw new UserFacingError(`${item.name}: order between ${item.minQuantity} and ${MAX_BULK_QUANTITY} units.`);
      }
      const unitPrice = unitPriceForQuantity(item.tiers, line.quantity)!;
      return {
        productId: item.id,
        planId: null,
        description: item.type === "app" ? `${item.name} · 1-year licence pack` : item.name,
        quantity: line.quantity,
        unitPrice,
        lineTotal: unitPrice * line.quantity,
      };
    });
  if (lines.length === 0) throw new UserFacingError("Enter a quantity for at least one product.");

  const order = await db.transaction((tx) =>
    createPendingOrder(tx, {
      userId: input.partner.id,
      partnerId: null, // partners earn their margin on resale, not commission on their own purchases
      kind: "partner_bulk",
      billing: { billingName: input.partner.name },
      lines,
      now,
    }),
  );
  return beginPayment(order, input.partner, `Partner bulk order ${order.number}`, now);
}

/** A client activates a one-year subscription using a key bought by their partner. */
export async function redeemLicenceKey(input: { userId: string; key: string; now?: Date }): Promise<Subscription> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    // Lock the key row so two people can't redeem the same key at once.
    const key = await first(
      tx
        .select()
        .from(licenceKeys)
        .where(and(eq(licenceKeys.key, input.key.trim().toUpperCase()), isNull(licenceKeys.redeemedAt)))
        .limit(1)
        .for("update", { skipLocked: true }),
    );
    if (!key) throw new UserFacingError("This licence key is not valid or has already been used.");

    const yearly = await first(tx.select().from(plans).where(and(eq(plans.productId, key.productId), eq(plans.interval, "year"))).limit(1));
    const product = await first(tx.select().from(products).where(eq(products.id, key.productId)).limit(1));
    if (!yearly || !product) throw new UserFacingError("This licence key cannot be activated right now.");

    const existing = await first(
      tx.select().from(subscriptions).where(and(eq(subscriptions.userId, input.userId), eq(subscriptions.productId, key.productId))).limit(1).for("update"),
    );
    if (existing?.status === "active") throw new UserFacingError(`You already have an active ${product.name} subscription.`);

    await tx.update(licenceKeys).set({ redeemedAt: now, redeemedByUserId: input.userId }).where(eq(licenceKeys.id, key.id));
    const buyer = await first(tx.select().from(users).where(eq(users.id, input.userId)).limit(1));
    if (buyer && !buyer.referredByPartnerId && buyer.id !== key.partnerId) {
      await tx.update(users).set({ referredByPartnerId: key.partnerId }).where(eq(users.id, buyer.id));
    }

    const values = {
      status: "active" as const,
      planId: yearly.id,
      partnerId: key.partnerId,
      currentPeriodStart: now,
      currentPeriodEnd: addInterval(now, "year"),
      cancelAtPeriodEnd: false,
      fromLicenceKeyId: key.id,
    };
    await audit(tx, { actorId: input.userId, action: "licence.redeemed", entityId: key.id });
    if (existing) return single(tx.update(subscriptions).set(values).where(eq(subscriptions.id, existing.id)).returning());
    return single(
      tx
        .insert(subscriptions)
        .values({ ...values, userId: input.userId, productId: key.productId, licenseKey: licenceKey(), createdAt: now })
        .returning(),
    );
  });
}

export async function listLicenceKeys(partnerId: string) {
  return db
    .select({ key: licenceKeys, productName: products.name, redeemedBy: users.companyName })
    .from(licenceKeys)
    .innerJoin(products, eq(products.id, licenceKeys.productId))
    .leftJoin(users, eq(users.id, licenceKeys.redeemedByUserId))
    .where(eq(licenceKeys.partnerId, partnerId))
    .orderBy(asc(licenceKeys.redeemedAt), asc(licenceKeys.createdAt));
}

/* ----------------------------------------------------------------- queries */

export type OrderWithItems = Order & { items: OrderItem[] };

/** Orders shown to the customer: abandoned checkouts (pending without a payment link) are hidden. */
export async function listOrdersForUser(userId: string): Promise<Order[]> {
  const rows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  return rows.filter((o) => o.status !== "pending" || o.paymentUrl);
}

/** Returns the order only if it belongs to the user (or for admins, any order). */
export async function getOrder(orderId: string, viewer: { id: string; role: string }): Promise<OrderWithItems | null> {
  if (!isUuid(orderId)) return null;
  const order = await first(db.select().from(orders).where(eq(orders.id, orderId)).limit(1));
  if (!order) return null;
  if (viewer.role !== "admin" && order.userId !== viewer.id) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { ...order, items };
}

export async function listSubscriptionsForUser(userId: string) {
  return db
    .select({ subscription: subscriptions, product: products, plan: plans })
    .from(subscriptions)
    .innerJoin(products, eq(products.id, subscriptions.productId))
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt));
}

export async function listAllOrders(limit = 200) {
  return db
    .select({ order: orders, customer: users.name, company: users.companyName })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}
