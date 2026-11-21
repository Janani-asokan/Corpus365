/**
 * Money is always held as an integer number of minor units (paise for INR)
 * to avoid floating-point rounding errors. Rates are held in basis points
 * (1 bps = 0.01%), so 30% = 3000 bps.
 */
export type Minor = number;
export type BasisPoints = number;

export const CURRENCY = "INR";
const BPS_DENOMINATOR = 10_000;

export function rupees(amount: number): Minor {
  return Math.round(amount * 100);
}

export function applyRate(amount: Minor, rate: BasisPoints): Minor {
  return Math.round((amount * rate) / BPS_DENOMINATOR);
}

export function sum(values: readonly Minor[]): Minor {
  return values.reduce((total, value) => total + value, 0);
}

export function bpsToPercent(rate: BasisPoints): string {
  const percent = rate / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

const formatters = new Map<number, Intl.NumberFormat>();

/** Formats paise as rupees, e.g. 1200000 -> "₹12,000". */
export function formatMoney(amount: Minor, fractionDigits = 0): string {
  let formatter = formatters.get(fractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: CURRENCY,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    formatters.set(fractionDigits, formatter);
  }
  return formatter.format(amount / 100);
}
