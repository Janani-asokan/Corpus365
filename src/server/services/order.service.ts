import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, type Tx } from "@/server/db/client";
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
import { listPartnerCatalog } from "./catalog.service";
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
export function priceRetailLines(lines: readonly CartLine[]): PricedLine[] {
  if (lines.length === 0) return [];
  const productRows = db.select().from(products).where(inArray(products.id, lines.map((l) => l.productId))).all();
  const planIds = lines.map((l) => l.planId).filter((id): id is string => Boolean(id));
  const planRows = planIds.length ? db.select().from(plans).where(inArray(plans.id, planIds)).all() : [];

  const priced: PricedLine[] = [];
  for (const line of lines) {
    const product = productRows.find((p) => p.id === line.productId);
    if (!product || product.status !== "live") continue; // silently drop unavailable items

    if (product.type === "app") {
      const plan = planRows.find((p) => p.id === line.planId && p.productId === product.id);
      if (!plan) continue;
      priced.push({
        product,
        plan,
        quantity: 1,
        unitPrice: plan.price,
        lineTotal: plan.price,
        description: `${product.name} · ${plan.name}`,
      });
    } else if (product.unitPrice) {
      const quantity = Math.min(Math.max(1, Math.floor(line.quantity)), MAX_HARDWARE_QUANTITY);
      priced.push({
        product,
        plan: null,
        quantity,
        unitPrice: product.unitPrice,
        lineTotal: product.unitPrice * quantity,
        description: product.name,
      });
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
function resolveAttribution(
  tx: Tx,
  buyerId: string,
  codes: { entered?: string | null; cookie?: string | null },
): string | null {
  const buyer = tx.select().from(users).where(eq(users.id, buyerId)).get();
  if (!buyer) throw new UserFacingError("Account not found.");

  if (buyer.referredByPartnerId) {
    const profile = getPartnerProfile(buyer.referredByPartnerId, tx);
    return profile?.status === "approved" ? profile.userId : null;
  }

  const entered = codes.entered?.trim();
  if (entered) {
    const partner = findApprovedPartnerByCode(entered, tx);
    if (!partner) throw new UserFacingError("That partner code is not valid. Check it with your partner or leave it blank.");
    return lockAttribution(tx, buyerId, partner.userId);
  }

  const fromCookie = codes.cookie ? findApprovedPartnerByCode(codes.cookie, tx) : null;
  return fromCookie ? lockAttribution(tx, buyerId, fromCookie.userId) : null;
}

function lockAttribution(tx: Tx, buyerId: string, partnerId: string): string | null {
  if (partnerId === buyerId) return null;
  tx.update(users).set({ referredByPartnerId: partnerId }).where(eq(users.id, buyerId)).run();
  return partnerId;
}

/* ---------------------------------------------------------------- ordering */

function nextOrderNumber(tx: Tx): string {
  const total = tx.select({ value: count() }).from(orders).get()?.value ?? 0;
  return `C365-${String(1001 + total).padStart(6, "0")}`;
}

interface NewOrderLine {
  productId: string;
  planId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export function createPendingOrder(
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
): Order {
  const totals = computeTotals(input.lines.map((l) => l.lineTotal));
  const order = tx
    .insert(orders)
    .values({
      number: nextOrderNumber(tx),
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
    .returning()
    .get();
  tx.insert(orderItems)
    .values(input.lines.map((line) => ({ ...line, orderId: order.id })))
    .run();
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
  const priced = priceRetailLines(input.lines);
  if (priced.length === 0) throw new UserFacingError("Your cart is empty or its items are no longer available.");

  const order = db.transaction((tx) => {
    for (const line of priced.filter((l) => l.product.type === "app")) {
      const active = tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, input.buyer.id), eq(subscriptions.productId, line.product.id), eq(subscriptions.status, "active")))
        .get();
      if (active) {
        throw new UserFacingError(`You already have an active ${line.product.name} subscription. Renew it from your account instead.`);
      }
    }

    const partnerId = resolveAttribution(tx, input.buyer.id, { entered: input.partnerCode, cookie: input.referralCookie });
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

export function startTrial(input: { userId: string; productId: string; referralCookie?: string | null; now?: Date }): Subscription {
  const now = input.now ?? new Date();
  return db.transaction((tx) => {
    const product = tx.select().from(products).where(eq(products.id, input.productId)).get();
    if (!product || product.type !== "app" || product.status !== "live" || !product.trialDays) {
      throw new UserFacingError("A free trial is not available for this product.");
    }
    const previous = tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, input.userId), eq(subscriptions.productId, product.id)))
      .get();
    if (previous) throw new UserFacingError(`You have already used your ${product.name} trial. Choose a plan to continue.`);

    const partnerId = resolveAttribution(tx, input.userId, { cookie: input.referralCookie });
    return tx
      .insert(subscriptions)
      .values({
        userId: input.userId,
        productId: product.id,
        planId: null,
        partnerId,
        status: "trialing",
        licenseKey: licenceKey(),
        currentPeriodStart: now,
        currentPeriodEnd: addDays(now, product.trialDays),
        createdAt: now,
      })
      .returning()
      .get();
  });
}

/* ---------------------------------------------------------------- renewals */

/** Creates (but does not charge) the renewal order for a paid subscription. */
export function createRenewalOrder(subscriptionId: string, now: Date, userId?: string): { order: Order; payer: Payer; description: string } {
  const row = db
    .select({ subscription: subscriptions, plan: plans, product: products, user: users })
    .from(subscriptions)
    .innerJoin(products, eq(products.id, subscriptions.productId))
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.id, subscriptionId))
    .get();

  if (!row || (userId && row.subscription.userId !== userId)) throw new UserFacingError("Subscription not found.");
  const { subscription, plan, product, user } = row;
  if (!plan || subscription.status === "trialing") throw new UserFacingError("Choose a plan to continue after your trial.");

  const description = `${product.name} · ${plan.name} renewal`;
  const order = db.transaction((tx) =>
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
}

/** Client-initiated renewal ("Renew now"): paid on-session through checkout. */
export async function renewSubscription(input: { subscriptionId: string; userId?: string; now?: Date }): Promise<PaymentOutcome> {
  const now = input.now ?? new Date();
  const { order, payer, description } = createRenewalOrder(input.subscriptionId, now, input.userId);
  return beginPayment(order, payer, description, now);
}

/** An unpaid renewal link for a subscription, if one is outstanding. */
export function pendingRenewalOrder(subscriptionId: string): Order | null {
  return (
    db
      .select()
      .from(orders)
      .where(and(eq(orders.subscriptionId, subscriptionId), eq(orders.kind, "renewal"), eq(orders.status, "pending")))
      .orderBy(desc(orders.createdAt))
      .get() ?? null
  );
}

export function setCancelAtPeriodEnd(userId: string, subscriptionId: string, cancel: boolean): void {
  const result = db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: cancel })
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .run();
  if (result.changes === 0) throw new UserFacingError("Subscription not found or not active.");
}

/* ------------------------------------------------------ partner bulk orders */

export async function placePartnerBulkOrder(input: {
  partner: Payer;
  lines: { productId: string; quantity: number }[];
  now?: Date;
}): Promise<PaymentOutcome> {
  const now = input.now ?? new Date();
  const profile = getPartnerProfile(input.partner.id);
  if (profile?.status !== "approved") throw new UserFacingError("Bulk ordering opens once your partner account is approved.");

  const catalog = listPartnerCatalog();
  const lines = input.lines
    .filter((l) => l.quantity > 0)
    .map((line) => {
      const item = catalog.find((c) => c.id === line.productId);
      if (!item) throw new UserFacingError("One of the selected products is not available for bulk ordering.");
      if (line.quantity < item.minQuantity || line.quantity > MAX_BULK_QUANTITY) {
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

  const order = db.transaction((tx) =>
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
export function redeemLicenceKey(input: { userId: string; key: string; now?: Date }): Subscription {
  const now = input.now ?? new Date();
  return db.transaction((tx) => {
    const key = tx
      .select()
      .from(licenceKeys)
      .where(and(eq(licenceKeys.key, input.key.trim().toUpperCase()), isNull(licenceKeys.redeemedAt)))
      .get();
    if (!key) throw new UserFacingError("This licence key is not valid or has already been used.");

    const yearly = tx
      .select()
      .from(plans)
      .where(and(eq(plans.productId, key.productId), eq(plans.interval, "year")))
      .get();
    const product = tx.select().from(products).where(eq(products.id, key.productId)).get();
    if (!yearly || !product) throw new UserFacingError("This licence key cannot be activated right now.");

    const active = tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, input.userId), eq(subscriptions.productId, key.productId), eq(subscriptions.status, "active")))
      .get();
    if (active) throw new UserFacingError(`You already have an active ${product.name} subscription.`);

    tx.update(licenceKeys).set({ redeemedAt: now, redeemedByUserId: input.userId }).where(eq(licenceKeys.id, key.id)).run();
    const buyer = tx.select().from(users).where(eq(users.id, input.userId)).get();
    if (buyer && !buyer.referredByPartnerId && buyer.id !== key.partnerId) {
      tx.update(users).set({ referredByPartnerId: key.partnerId }).where(eq(users.id, buyer.id)).run();
    }

    const existing = tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, input.userId), eq(subscriptions.productId, key.productId)))
      .get();
    const values = {
      status: "active" as const,
      planId: yearly.id,
      partnerId: key.partnerId,
      currentPeriodStart: now,
      currentPeriodEnd: addInterval(now, "year"),
      cancelAtPeriodEnd: false,
      fromLicenceKeyId: key.id,
    };
    audit(tx, { actorId: input.userId, action: "licence.redeemed", entityId: key.id });
    if (existing) {
      return tx.update(subscriptions).set(values).where(eq(subscriptions.id, existing.id)).returning().get();
    }
    return tx
      .insert(subscriptions)
      .values({ ...values, userId: input.userId, productId: key.productId, licenseKey: licenceKey(), createdAt: now })
      .returning()
      .get();
  });
}

export function listLicenceKeys(partnerId: string) {
  return db
    .select({ key: licenceKeys, productName: products.name, redeemedBy: users.companyName })
    .from(licenceKeys)
    .innerJoin(products, eq(products.id, licenceKeys.productId))
    .leftJoin(users, eq(users.id, licenceKeys.redeemedByUserId))
    .where(eq(licenceKeys.partnerId, partnerId))
    .orderBy(licenceKeys.redeemedAt)
    .all();
}

/* ----------------------------------------------------------------- queries */

export type OrderWithItems = Order & { items: OrderItem[] };

/** Orders shown to the customer: abandoned checkouts (pending without a payment link) are hidden. */
export function listOrdersForUser(userId: string): Order[] {
  return db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .all()
    .filter((o) => o.status !== "pending" || o.paymentUrl);
}

/** Returns the order only if it belongs to the user (or for admins, any order). */
export function getOrder(orderId: string, viewer: { id: string; role: string }): OrderWithItems | null {
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) return null;
  if (viewer.role !== "admin" && order.userId !== viewer.id) return null;
  const items = db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).all();
  return { ...order, items };
}

export function listSubscriptionsForUser(userId: string) {
  return db
    .select({ subscription: subscriptions, product: products, plan: plans })
    .from(subscriptions)
    .innerJoin(products, eq(products.id, subscriptions.productId))
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .all();
}

export function listAllOrders(limit = 200) {
  return db
    .select({ order: orders, customer: users.name, company: users.companyName })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .all();
}
