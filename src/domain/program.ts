import { rupees, type BasisPoints, type Minor } from "./money";

/**
 * Commercial programme settings. Every value here is marked "proposed" in the
 * Corpus365 brief, so they live in one place for the business to tune.
 */
export const PROGRAM = {
  /** GST charged to clients on top of list prices. Commissions exclude GST. */
  gstRate: 1800 as BasisPoints,
  /** Commissions are held this long (refund window) before they can be paid out. */
  clearanceDays: 14,
  /** Launch bonus: an extra fixed reward on each of the first N sales within the window. */
  launchBonus: {
    amount: rupees(500) as Minor,
    maxSales: 3,
    windowDays: 60,
  },
  /** Default one-time hardware margin when a product does not define its own (8–12%). */
  defaultHardwareMargin: 1000 as BasisPoints,
  /** How long a referral link keeps a visitor attributed to a partner. */
  referralCookieDays: 30,
  /** Days a client has to pay a renewal link before the subscription lapses. */
  renewalGraceDays: 7,
  /** Default free-trial length for apps. */
  defaultTrialDays: 14,
} as const;
