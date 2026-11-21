import { and, count, countDistinct, desc, eq, gt, inArray, isNotNull, or, sql, sum } from "drizzle-orm";
import { db, type Executor } from "@/server/db/client";
import { commissions, partnerProfiles, subscriptions, users, type PartnerProfile, type User } from "@/server/db/schema";
import { resolveTier, renewalRate, tierProgress, type PartnerPerformance, type Tier } from "@/domain/tiers";
import { PROGRAM } from "@/domain/program";
import { addDays } from "@/domain/pricing";
import type { PartnerStatus } from "@/domain/constants";
import { getMailer } from "@/server/mail/mailer";
import { config } from "@/lib/config";
import { UserFacingError } from "@/lib/errors";
import { audit } from "./audit.service";

export type PartnerAccount = { user: User; profile: PartnerProfile };

export function getPartnerProfile(userId: string, executor: Executor = db): PartnerProfile | null {
  return executor.select().from(partnerProfiles).where(eq(partnerProfiles.userId, userId)).get() ?? null;
}

/** Finds an approved partner by referral code (case-insensitive). */
export function findApprovedPartnerByCode(code: string, executor: Executor = db): PartnerProfile | null {
  return (
    executor
      .select()
      .from(partnerProfiles)
      .where(and(eq(partnerProfiles.code, code.trim().toUpperCase()), eq(partnerProfiles.status, "approved")))
      .get() ?? null
  );
}

export function referralLink(code: string, productSlug?: string): string {
  const base = `${config.appUrl}/r/${code}`;
  return productSlug ? `${base}?to=${encodeURIComponent(productSlug)}` : base;
}

/**
 * Measures a partner's own book of business. Only the partner's own clients
 * count (single level — no credit for other partners' sales).
 */
export function getPerformance(partnerId: string, executor: Executor = db): PartnerPerformance {
  const active = executor
    .select({ value: countDistinct(subscriptions.userId) })
    .from(subscriptions)
    .where(and(eq(subscriptions.partnerId, partnerId), eq(subscriptions.status, "active")))
    .get();

  // A subscription "came up for renewal" if it was paid (not a bare trial) and
  // either renewed or lapsed at the end of a paid period.
  const paid = or(isNotNull(subscriptions.planId), isNotNull(subscriptions.fromLicenceKeyId));
  const due = executor
    .select({
      due: count(),
      made: sum(sql`case when ${subscriptions.renewalCount} > 0 then 1 else 0 end`),
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.partnerId, partnerId),
        paid,
        or(gt(subscriptions.renewalCount, 0), inArray(subscriptions.status, ["expired", "cancelled"])),
      ),
    )
    .get();

  return {
    activeClients: active?.value ?? 0,
    renewalsDue: due?.due ?? 0,
    renewalsMade: Number(due?.made ?? 0),
  };
}

export function currentTier(partnerId: string, executor: Executor = db): Tier {
  return resolveTier(getPerformance(partnerId, executor));
}

export function getPartnerOverview(partnerId: string) {
  const performance = getPerformance(partnerId);
  return { performance, progress: tierProgress(performance), renewalRate: renewalRate(performance) };
}

export interface EarningsSummary {
  pendingClearance: number;
  available: number;
  inPayout: number;
  paid: number;
  lifetime: number;
  thisMonth: number;
}

export function getEarningsSummary(partnerId: string, now = new Date()): EarningsSummary {
  const cleared = addDays(now, -PROGRAM.clearanceDays);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const rows = db
    .select({ amount: commissions.amount, status: commissions.status, createdAt: commissions.createdAt })
    .from(commissions)
    .where(eq(commissions.partnerId, partnerId))
    .all();

  const summary: EarningsSummary = { pendingClearance: 0, available: 0, inPayout: 0, paid: 0, lifetime: 0, thisMonth: 0 };
  for (const row of rows) {
    if (row.status === "reversed") continue;
    summary.lifetime += row.amount;
    if (row.createdAt >= monthStart) summary.thisMonth += row.amount;
    if (row.status === "paid") summary.paid += row.amount;
    else if (row.status === "in_payout") summary.inPayout += row.amount;
    else if (row.createdAt > cleared) summary.pendingClearance += row.amount;
    else summary.available += row.amount;
  }
  return summary;
}

export function listCommissions(partnerId: string, limit = 100) {
  return db
    .select()
    .from(commissions)
    .where(eq(commissions.partnerId, partnerId))
    .orderBy(desc(commissions.createdAt))
    .limit(limit)
    .all();
}

/** Clients attributed to the partner, with their subscriptions. */
export function listPartnerClients(partnerId: string) {
  const rows = db
    .select({
      userId: users.id,
      name: users.name,
      companyName: users.companyName,
      city: users.city,
      email: users.email,
      phone: users.phone,
      status: subscriptions.status,
      productId: subscriptions.productId,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .innerJoin(users, eq(users.id, subscriptions.userId))
    .where(eq(subscriptions.partnerId, partnerId))
    .orderBy(desc(subscriptions.currentPeriodEnd))
    .all();

  const byClient = new Map<string, { client: (typeof rows)[number]; subscriptions: typeof rows }>();
  for (const row of rows) {
    const entry = byClient.get(row.userId) ?? { client: row, subscriptions: [] };
    entry.subscriptions.push(row);
    byClient.set(row.userId, entry);
  }
  return [...byClient.values()];
}

export function listPartners(status?: PartnerStatus) {
  return db
    .select({ user: users, profile: partnerProfiles })
    .from(partnerProfiles)
    .innerJoin(users, eq(users.id, partnerProfiles.userId))
    .where(status ? eq(partnerProfiles.status, status) : undefined)
    .orderBy(desc(users.createdAt))
    .all();
}

export async function reviewPartner(input: {
  adminId: string;
  partnerId: string;
  decision: Extract<PartnerStatus, "approved" | "rejected" | "suspended">;
  note?: string | null;
}): Promise<void> {
  const account = db
    .select({ user: users, profile: partnerProfiles })
    .from(partnerProfiles)
    .innerJoin(users, eq(users.id, partnerProfiles.userId))
    .where(eq(partnerProfiles.userId, input.partnerId))
    .get();
  if (!account) throw new UserFacingError("Partner not found.");

  db.transaction((tx) => {
    tx.update(partnerProfiles)
      .set({
        status: input.decision,
        reviewNote: input.note ?? null,
        approvedAt: input.decision === "approved" ? (account.profile.approvedAt ?? new Date()) : account.profile.approvedAt,
      })
      .where(eq(partnerProfiles.userId, input.partnerId))
      .run();
    audit(tx, { actorId: input.adminId, action: `partner.${input.decision}`, entityId: input.partnerId, detail: input.note ?? undefined });
  });

  const messages = {
    approved: `Your Corpus365 Channel Partner account is approved. Your partner code is ${account.profile.code} and your link is ${referralLink(account.profile.code)}.`,
    rejected: "Thank you for applying. We are unable to approve your Corpus365 partner application at this time.",
    suspended: "Your Corpus365 partner account has been suspended. Please contact partner support.",
  } as const;
  await getMailer().send({
    to: account.user.email,
    subject: `Corpus365 partner application: ${input.decision}`,
    text: `Hi ${account.user.name},\n\n${messages[input.decision]}${input.note ? `\n\nNote: ${input.note}` : ""}`,
  });
}

export function updatePayoutUpi(partnerId: string, payoutUpi: string): void {
  db.update(partnerProfiles).set({ payoutUpi }).where(eq(partnerProfiles.userId, partnerId)).run();
}
