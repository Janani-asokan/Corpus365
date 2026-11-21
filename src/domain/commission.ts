import { applyRate, type BasisPoints, type Minor } from "./money";
import { PROGRAM } from "./program";
import type { CommissionKind } from "./constants";
import type { Tier } from "./tiers";

export interface CommissionLine {
  kind: CommissionKind;
  baseAmount: Minor;
  rate: BasisPoints;
  amount: Minor;
}

export type SaleLine =
  | { type: "app"; netAmount: Minor; isRenewal: boolean }
  | { type: "hardware"; netAmount: Minor; marginRate: BasisPoints | null };

/**
 * Commission earned on one order line. Partners earn only on software sold and
 * renewed and on hardware margin — never on recruiting (single level).
 * `netAmount` must exclude GST.
 */
export function commissionForLine(line: SaleLine, tier: Tier): CommissionLine | null {
  if (line.netAmount <= 0) return null;

  if (line.type === "hardware") {
    const rate = line.marginRate ?? PROGRAM.defaultHardwareMargin;
    return { kind: "hardware", baseAmount: line.netAmount, rate, amount: applyRate(line.netAmount, rate) };
  }

  const kind: CommissionKind = line.isRenewal ? "renewal" : "sale";
  const rate = line.isRenewal ? tier.renewalRate : tier.saleRate;
  return { kind, baseAmount: line.netAmount, rate, amount: applyRate(line.netAmount, rate) };
}

/**
 * Whether a new sale earns the fast-start launch bonus: one of the partner's
 * first N app sales, made within the window after approval.
 */
export function qualifiesForLaunchBonus(input: {
  approvedAt: Date;
  saleAt: Date;
  previousAppSales: number;
}): boolean {
  const { maxSales, windowDays } = PROGRAM.launchBonus;
  const windowEnd = input.approvedAt.getTime() + windowDays * 86_400_000;
  return input.previousAppSales < maxSales && input.saleAt.getTime() <= windowEnd;
}
