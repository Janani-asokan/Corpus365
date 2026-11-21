import { and, count, countDistinct, desc, eq, gt, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db, type Executor } from "@/server/db/client";
import { first } from "@/server/db/query";
import { commissions, partnerProfiles, subscriptions, users, type PartnerProfile } from "@/server/db/schema";
import { resolveTier, renewalRate, tierProgress, type PartnerPerformance, type Tier } from "@/domain/tiers";
import { PROGRAM } from "@/domain/program";
import { addDays } from "@/domain/pricing";
import type { PartnerStatus } from "@/domain/constants";
import { getMailer } from "@/server/mail/mailer";
import { config } from "@/lib/config";
import { UserFacingError } from "@/lib/errors";
import { audit } from "./audit.service";

export async function getPartnerProfile(userId: string, executor: Executor = db): Promise<PartnerProfile | null> {
  return (await first(executor.select().from(partnerProfiles).where(eq(partnerProfiles.userId, userId)).limit(1))) ?? null;
}

/** Finds an approved partner by referral code (case-insensitive). */
export async function findApprovedPartnerByCode(code: string, executor: Executor = db): Promise<PartnerProfile | null> {
  return (
    (await first(
      executor
        .select()
        .from(partnerProfiles)
        .where(and(eq(partnerProfiles.code, code.trim().toUpperCase()), eq(partnerProfiles.status, "approved")))
        .limit(1),
    )) ?? null
  );
}

/** Name and code of a partner, for showing to their clients. */
export async function getPartnerContact(partnerId: string) {
  return (
    (await first(
      db
        .select({ name: users.name, email: users.email, phone: users.phone, city: users.city, code: partnerProfiles.code })
        .from(partnerProfiles)
        .innerJoin(users, eq(users.id, partnerProfiles.userId))
        .where(eq(partnerProfiles.userId, partnerId))
        .limit(1),
    )) ?? null
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
export async function getPerformance(partnerId: string, executor: Executor = db): Promise<PartnerPerformance> {
  const active = await first(
    executor
      .select({ value: countDistinct(subscriptions.userId) })
      .from(subscriptions)
      .where(and(eq(subscriptions.partnerId, partnerId), eq(subscriptions.status, "active"))),
  );

  // A subscription "came up for renewal" if it was paid (not a bare trial) and
  // either renewed or lapsed at the end of a paid period.
  const paid = or(isNotNull(subscriptions.planId), isNotNull(subscriptions.fromLicenceKeyId));
  const due = await first(
    executor
      .select({
        due: count(),
        made: sql<number>`count(*) filter (where ${subscriptions.renewalCount} > 0)`.mapWith(Number),
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.partnerId, partnerId),
          paid,
          or(gt(subscriptions.renewalCount, 0), inArray(subscriptions.status, ["expired", "cancelled"])),
        ),
      ),
  );

  return { activeClients: active?.value ?? 0, renewalsDue: due?.due ?? 0, renewalsMade: due?.made ?? 0 };
}

export async function currentTier(partnerId: string, executor: Executor = db): Promise<Tier> {
  return resolveTier(await getPerformance(partnerId, executor));
}

export async function getPartnerOverview(partnerId: string) {
  const performance = await getPerformance(partnerId);
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

/** Aggregated in the database, not in application memory. */
export async function getEarningsSummary(partnerId: string, now = new Date()): Promise<EarningsSummary> {
  const cleared = addDays(now, -PROGRAM.clearanceDays);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const amount = (filter: ReturnType<typeof sql>) =>
    sql<number>`coalesce(sum(${commissions.amount}) filter (where ${filter}), 0)`.mapWith(Number);

  const row = await first(
    db
      .select({
        pendingClearance: amount(sql`${commissions.status} = 'pending' and ${commissions.createdAt} > ${cleared}`),
        available: amount(sql`${commissions.status} = 'pending' and ${commissions.createdAt} <= ${cleared}`),
        inPayout: amount(sql`${commissions.status} = 'in_payout'`),
        paid: amount(sql`${commissions.status} = 'paid'`),
        lifetime: amount(sql`${commissions.status} <> 'reversed'`),
        thisMonth: amount(sql`${commissions.status} <> 'reversed' and ${commissions.createdAt} >= ${monthStart}`),
      })
      .from(commissions)
      .where(eq(commissions.partnerId, partnerId)),
  );
  return row ?? { pendingClearance: 0, available: 0, inPayout: 0, paid: 0, lifetime: 0, thisMonth: 0 };
}

export async function listCommissions(partnerId: string, limit = 100) {
  return db.select().from(commissions).where(eq(commissions.partnerId, partnerId)).orderBy(desc(commissions.createdAt)).limit(limit);
}

/** Clients attributed to the partner, with their subscriptions. */
export async function listPartnerClients(partnerId: string) {
  const rows = await db
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
    .orderBy(desc(subscriptions.currentPeriodEnd));

  const byClient = new Map<string, { client: (typeof rows)[number]; subscriptions: typeof rows }>();
  for (const row of rows) {
    const entry = byClient.get(row.userId) ?? { client: row, subscriptions: [] };
    entry.subscriptions.push(row);
    byClient.set(row.userId, entry);
  }
  return [...byClient.values()];
}

export async function listPartners(status?: PartnerStatus) {
  return db
    .select({ user: users, profile: partnerProfiles })
    .from(partnerProfiles)
    .innerJoin(users, eq(users.id, partnerProfiles.userId))
    .where(status ? eq(partnerProfiles.status, status) : undefined)
    .orderBy(desc(users.createdAt));
}

export async function reviewPartner(input: {
  adminId: string;
  partnerId: string;
  decision: Extract<PartnerStatus, "approved" | "rejected" | "suspended">;
  note?: string | null;
}): Promise<void> {
  const account = await first(
    db
      .select({ user: users, profile: partnerProfiles })
      .from(partnerProfiles)
      .innerJoin(users, eq(users.id, partnerProfiles.userId))
      .where(eq(partnerProfiles.userId, input.partnerId))
      .limit(1),
  );
  if (!account) throw new UserFacingError("Partner not found.");

  await db.transaction(async (tx) => {
    await tx
      .update(partnerProfiles)
      .set({
        status: input.decision,
        reviewNote: input.note ?? null,
        approvedAt: input.decision === "approved" ? (account.profile.approvedAt ?? new Date()) : account.profile.approvedAt,
      })
      .where(eq(partnerProfiles.userId, input.partnerId));
    await audit(tx, { actorId: input.adminId, action: `partner.${input.decision}`, entityId: input.partnerId, detail: input.note ?? undefined });
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

export async function updatePayoutUpi(partnerId: string, payoutUpi: string): Promise<void> {
  await db.update(partnerProfiles).set({ payoutUpi }).where(eq(partnerProfiles.userId, partnerId));
}
