import type { BasisPoints } from "./money";

export const TIER_IDS = ["channel", "silver", "gold", "platinum"] as const;
export type TierId = (typeof TIER_IDS)[number];

export interface Tier {
  id: TierId;
  name: string;
  /** Minimum number of the partner's own active clients. */
  minActiveClients: number;
  /** Minimum share of clients renewing, in bps (null = no requirement). */
  minRenewalRate: BasisPoints | null;
  saleRate: BasisPoints;
  renewalRate: BasisPoints;
  perks: string[];
}

/** The Channel Partner growth path, lowest tier first. */
export const TIERS: readonly Tier[] = [
  {
    id: "channel",
    name: "Channel Partner",
    minActiveClients: 0,
    minRenewalRate: null,
    saleRate: 2000,
    renewalRate: 1000,
    perks: ["Training", "Demo account", "Sales kit"],
  },
  {
    id: "silver",
    name: "Silver Channel Partner",
    minActiveClients: 10,
    minRenewalRate: null,
    saleRate: 2500,
    renewalRate: 1200,
    perks: ["Co-branded brochures", "Shared leads"],
  },
  {
    id: "gold",
    name: "Gold Channel Partner",
    minActiveClients: 25,
    minRenewalRate: 8000,
    saleRate: 3000,
    renewalRate: 1500,
    perks: ["Quarterly bonus pool", "Priority leads"],
  },
  {
    id: "platinum",
    name: "Platinum Channel Partner",
    minActiveClients: 50,
    minRenewalRate: 8500,
    saleRate: 3500,
    renewalRate: 2000,
    perks: ["International trip", "Regional title"],
  },
];

/**
 * A renewal rate measured over only a handful of subscriptions is noise, and in
 * a partner's first year nothing has come up for renewal yet. Until this many
 * subscriptions have reached a renewal date, the renewal requirement is
 * treated as met so partners can progress on client count alone.
 */
export const MIN_RENEWAL_SAMPLE = 10;

export interface PartnerPerformance {
  activeClients: number;
  /** Subscriptions that reached a renewal date. */
  renewalsDue: number;
  /** Of those, how many renewed. */
  renewalsMade: number;
}

/** Renewal rate in bps, or null when there is not yet enough history. */
export function renewalRate(perf: PartnerPerformance): BasisPoints | null {
  if (perf.renewalsDue < MIN_RENEWAL_SAMPLE) return null;
  return Math.round((perf.renewalsMade / perf.renewalsDue) * 10_000);
}

function qualifies(tier: Tier, perf: PartnerPerformance): boolean {
  if (perf.activeClients < tier.minActiveClients) return false;
  if (tier.minRenewalRate === null) return true;
  const rate = renewalRate(perf);
  return rate === null || rate >= tier.minRenewalRate;
}

export function getTier(id: TierId): Tier {
  const tier = TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown tier: ${id}`);
  return tier;
}

/** The highest tier the partner currently qualifies for. */
export function resolveTier(perf: PartnerPerformance): Tier {
  let current = TIERS[0]!;
  for (const tier of TIERS) {
    if (qualifies(tier, perf)) current = tier;
  }
  return current;
}

export interface TierProgress {
  current: Tier;
  next: Tier | null;
  clientsNeeded: number;
  /** 0–100, progress in active clients towards the next tier. */
  percent: number;
}

export function tierProgress(perf: PartnerPerformance): TierProgress {
  const current = resolveTier(perf);
  const index = TIERS.indexOf(current);
  const next = TIERS[index + 1] ?? null;
  if (!next) return { current, next: null, clientsNeeded: 0, percent: 100 };

  const span = next.minActiveClients - current.minActiveClients;
  const done = perf.activeClients - current.minActiveClients;
  return {
    current,
    next,
    clientsNeeded: Math.max(0, next.minActiveClients - perf.activeClients),
    percent: Math.min(100, Math.max(0, Math.round((done / span) * 100))),
  };
}
