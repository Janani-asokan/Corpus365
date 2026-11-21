import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  BILLING_INTERVALS,
  COMMISSION_KINDS,
  COMMISSION_STATUSES,
  LEAD_STATUSES,
  ORDER_KINDS,
  ORDER_STATUSES,
  PARTNER_STATUSES,
  PAYOUT_STATUSES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  QUOTE_STATUSES,
  ROLES,
  SUBSCRIPTION_STATUSES,
} from "@/domain/constants";

/* Conventions: ids are UUID text, money is integer minor units (paise),
   rates are integer basis points, timestamps are unix-ms integers. */

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () => timestamp("created_at").notNull().default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
  phone: text("phone"),
  companyName: text("company_name"),
  city: text("city"),
  /** First-touch partner attribution, fixed once set. */
  referredByPartnerId: text("referred_by_partner_id"),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    /** SHA-256 of the session token; the raw token only ever lives in the cookie. */
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: text("id").primaryKey(), // SHA-256 of the emailed token
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const partnerProfiles = sqliteTable("partner_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  status: text("status", { enum: PARTNER_STATUSES }).notNull().default("pending"),
  profession: text("profession").notNull(),
  region: text("region").notNull(),
  experience: text("experience"),
  payoutUpi: text("payout_upi"),
  agreementAcceptedAt: timestamp("agreement_accepted_at").notNull(),
  approvedAt: timestamp("approved_at"),
  reviewNote: text("review_note"),
});

export const products = sqliteTable("products", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: text("type", { enum: PRODUCT_TYPES }).notNull(),
  category: text("category").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  features: text("features", { mode: "json" }).$type<string[]>().notNull(),
  /** Business types / apps this works with, e.g. "Retail", "Fitness". */
  worksWith: text("works_with", { mode: "json" }).$type<string[]>().notNull(),
  status: text("status", { enum: PRODUCT_STATUSES }).notNull(),
  icon: text("icon").notNull(),
  trialDays: integer("trial_days"),
  /** Retail unit price for hardware; apps are priced through plans. */
  unitPrice: integer("unit_price"),
  /** One-time partner margin on hardware sales, bps. */
  hardwareMargin: integer("hardware_margin"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const plans = sqliteTable("plans", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  interval: text("interval", { enum: BILLING_INTERVALS }).notNull(),
  price: integer("price").notNull(),
});

/** Volume pricing available to approved partners (bulk licences and hardware). */
export const partnerPriceTiers = sqliteTable(
  "partner_price_tiers",
  {
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    minQuantity: integer("min_quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.minQuantity] })],
);

export const orders = sqliteTable(
  "orders",
  {
    id: id(),
    number: text("number").notNull().unique(),
    userId: text("user_id").notNull().references(() => users.id),
    /** Partner credited for this order, if any. */
    partnerId: text("partner_id").references(() => users.id),
    kind: text("kind", { enum: ORDER_KINDS }).notNull(),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
    subtotal: integer("subtotal").notNull(),
    tax: integer("tax").notNull(),
    total: integer("total").notNull(),
    paymentReference: text("payment_reference"),
    billingName: text("billing_name").notNull(),
    billingCompany: text("billing_company"),
    billingGstin: text("billing_gstin"),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at"),
  },
  (t) => [index("orders_user_idx").on(t.userId), index("orders_partner_idx").on(t.partnerId)],
);

export const orderItems = sqliteTable("order_items", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  planId: text("plan_id").references(() => plans.id),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  lineTotal: integer("line_total").notNull(),
});

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id),
    productId: text("product_id").notNull().references(() => products.id),
    planId: text("plan_id").references(() => plans.id),
    partnerId: text("partner_id").references(() => users.id),
    status: text("status", { enum: SUBSCRIPTION_STATUSES }).notNull(),
    licenseKey: text("license_key").notNull().unique(),
    currentPeriodStart: timestamp("current_period_start").notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
    renewalCount: integer("renewal_count").notNull().default(0),
    /** Set when activated from a partner's bulk licence key rather than paid directly. */
    fromLicenceKeyId: text("from_licence_key_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("subscriptions_user_idx").on(t.userId),
    index("subscriptions_partner_idx").on(t.partnerId),
    index("subscriptions_period_end_idx").on(t.currentPeriodEnd),
  ],
);

/** Licence keys issued from a partner's bulk licence order, redeemable by clients. */
export const licenceKeys = sqliteTable("licence_keys", {
  id: id(),
  key: text("key").notNull().unique(),
  orderItemId: text("order_item_id").notNull().references(() => orderItems.id, { onDelete: "cascade" }),
  partnerId: text("partner_id").notNull().references(() => users.id),
  productId: text("product_id").notNull().references(() => products.id),
  redeemedAt: timestamp("redeemed_at"),
  redeemedByUserId: text("redeemed_by_user_id").references(() => users.id),
});

export const payouts = sqliteTable("payouts", {
  id: id(),
  partnerId: text("partner_id").notNull().references(() => users.id),
  period: text("period").notNull(), // YYYY-MM
  amount: integer("amount").notNull(),
  status: text("status", { enum: PAYOUT_STATUSES }).notNull().default("pending"),
  reference: text("reference"),
  createdAt: createdAt(),
  paidAt: timestamp("paid_at"),
});

export const commissions = sqliteTable(
  "commissions",
  {
    id: id(),
    partnerId: text("partner_id").notNull().references(() => users.id),
    orderId: text("order_id").references(() => orders.id),
    subscriptionId: text("subscription_id").references(() => subscriptions.id),
    kind: text("kind", { enum: COMMISSION_KINDS }).notNull(),
    description: text("description").notNull(),
    baseAmount: integer("base_amount").notNull(),
    rate: integer("rate").notNull(),
    amount: integer("amount").notNull(),
    tier: text("tier").notNull(),
    status: text("status", { enum: COMMISSION_STATUSES }).notNull().default("pending"),
    payoutId: text("payout_id").references(() => payouts.id),
    createdAt: createdAt(),
  },
  (t) => [index("commissions_partner_idx").on(t.partnerId, t.status)],
);

export const leads = sqliteTable(
  "leads",
  {
    id: id(),
    partnerId: text("partner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    productId: text("product_id").references(() => products.id),
    status: text("status", { enum: LEAD_STATUSES }).notNull().default("new"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (t) => [index("leads_partner_idx").on(t.partnerId)],
);

export const quoteRequests = sqliteTable("quote_requests", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id),
  userId: text("user_id").references(() => users.id),
  partnerId: text("partner_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  city: text("city").notNull(),
  message: text("message"),
  status: text("status", { enum: QUOTE_STATUSES }).notNull().default("open"),
  createdAt: createdAt(),
});

/** Append-only record of sensitive actions, for accountability. */
export const auditEvents = sqliteTable("audit_events", {
  id: id(),
  actorId: text("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entityId: text("entity_id"),
  detail: text("detail"),
  createdAt: createdAt(),
});


export type User = typeof users.$inferSelect;
export type PartnerProfile = typeof partnerProfiles.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Commission = typeof commissions.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type QuoteRequest = typeof quoteRequests.$inferSelect;
