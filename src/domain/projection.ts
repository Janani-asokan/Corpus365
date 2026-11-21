import { applyRate, type Minor } from "./money";
import { getTier, type TierId } from "./tiers";

export interface EarningsEstimate {
  firstYear: Minor;
  yearlyRenewals: Minor;
  perMonthFirstYear: Minor;
}

/**
 * Illustrative partner earnings for the public calculator: commission on the
 * first sale for each client, and on renewals from year two (assuming the
 * given share of clients renew).
 */
export function estimateEarnings(input: {
  clients: number;
  yearlyPrice: Minor;
  tier: TierId;
  renewingShare: number; // 0..1
}): EarningsEstimate {
  const tier = getTier(input.tier);
  const firstYear = input.clients * applyRate(input.yearlyPrice, tier.saleRate);
  const renewingClients = Math.round(input.clients * input.renewingShare);
  const yearlyRenewals = renewingClients * applyRate(input.yearlyPrice, tier.renewalRate);
  return { firstYear, yearlyRenewals, perMonthFirstYear: Math.round(firstYear / 12) };
}
