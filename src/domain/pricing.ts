import { applyRate, sum, type Minor } from "./money";
import { PROGRAM } from "./program";
import type { BillingInterval } from "./constants";

export interface PriceTier {
  minQuantity: number;
  unitPrice: Minor;
}

/** Picks the unit price for a quantity from volume tiers (highest tier reached wins). */
export function unitPriceForQuantity(tiers: readonly PriceTier[], quantity: number): Minor | null {
  const eligible = tiers
    .filter((t) => quantity >= t.minQuantity)
    .sort((a, b) => b.minQuantity - a.minQuantity);
  return eligible[0]?.unitPrice ?? null;
}

export function minimumQuantity(tiers: readonly PriceTier[]): number {
  return tiers.length === 0 ? 1 : Math.min(...tiers.map((t) => t.minQuantity));
}

export interface Totals {
  subtotal: Minor;
  tax: Minor;
  total: Minor;
}

export function computeTotals(lineTotals: readonly Minor[]): Totals {
  const subtotal = sum(lineTotals);
  const tax = applyRate(subtotal, PROGRAM.gstRate);
  return { subtotal, tax, total: subtotal + tax };
}

/** Saving of a yearly plan versus paying monthly for twelve months, in whole percent. */
export function yearlySavingPercent(monthly: Minor, yearly: Minor): number {
  const fullYear = monthly * 12;
  if (fullYear <= 0 || yearly >= fullYear) return 0;
  return Math.round(((fullYear - yearly) / fullYear) * 100);
}

export function addInterval(from: Date, interval: BillingInterval, count = 1): Date {
  const next = new Date(from);
  if (interval === "month") next.setMonth(next.getMonth() + count);
  else next.setFullYear(next.getFullYear() + count);
  return next;
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}
