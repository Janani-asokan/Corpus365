/**
 * Shared enumerations. These tuples are the
 * single source of truth for allowed values (used by the schema, validation
 * and UI alike).
 */
export const ROLES = ["client", "partner", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const PRODUCT_TYPES = ["app", "hardware"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/** live: can be bought. coming_soon: listed only. quote_only: priced per site. */
export const PRODUCT_STATUSES = ["live", "coming_soon", "quote_only"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const PARTNER_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const ORDER_KINDS = ["retail", "renewal", "partner_bulk"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

export const ORDER_STATUSES = ["pending", "paid", "failed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "cancelled", "expired"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const COMMISSION_KINDS = ["sale", "renewal", "hardware", "launch_bonus"] as const;
export type CommissionKind = (typeof COMMISSION_KINDS)[number];

export const COMMISSION_STATUSES = ["pending", "in_payout", "paid", "reversed"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const PAYOUT_STATUSES = ["pending", "paid"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const LEAD_STATUSES = ["new", "contacted", "demo", "trial", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const QUOTE_STATUSES = ["open", "quoted", "closed"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
