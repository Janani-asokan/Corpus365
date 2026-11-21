import { and, desc, eq, lte, sql, sum } from "drizzle-orm";
import { db } from "@/server/db/client";
import { first, single } from "@/server/db/query";
import { commissions, partnerProfiles, payouts, users } from "@/server/db/schema";
import { PROGRAM } from "@/domain/program";
import { addDays } from "@/domain/pricing";
import { formatMoney } from "@/domain/money";
import { getMailer } from "@/server/mail/mailer";
import { UserFacingError } from "@/lib/errors";
import { audit } from "./audit.service";
import { isUuid } from "./catalog.service";

/** Serialises payout runs across all app instances (transaction-scoped advisory lock). */
const PAYOUT_RUN_LOCK = 3650002;

export function periodOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Monthly payout run: bundles each partner's cleared commissions (older than
 * the refund window) into one payout. Commissions move to "in_payout" so they
 * can never be paid twice.
 */
export async function generatePayouts(adminId: string, now = new Date()): Promise<{ created: number; total: number }> {
  const clearedBefore = addDays(now, -PROGRAM.clearanceDays);
  const period = periodOf(now);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${PAYOUT_RUN_LOCK})`);
    const cleared = and(eq(commissions.status, "pending"), lte(commissions.createdAt, clearedBefore));
    const due = await tx
      .select({ partnerId: commissions.partnerId, amount: sum(commissions.amount).mapWith(Number) })
      .from(commissions)
      .where(cleared)
      .groupBy(commissions.partnerId);

    let created = 0;
    let total = 0;
    for (const row of due) {
      if (row.amount <= 0) continue;
      const payout = await single(tx.insert(payouts).values({ partnerId: row.partnerId, period, amount: row.amount, createdAt: now }).returning());
      await tx
        .update(commissions)
        .set({ status: "in_payout", payoutId: payout.id })
        .where(and(eq(commissions.partnerId, row.partnerId), cleared));
      created += 1;
      total += row.amount;
    }
    await audit(tx, { actorId: adminId, action: "payouts.generated", detail: `${created} payouts for ${period}` });
    return { created, total };
  });
}

export async function markPayoutPaid(adminId: string, payoutId: string, reference: string, now = new Date()): Promise<void> {
  if (!isUuid(payoutId)) throw new UserFacingError("Payout not found.");
  const row = await db.transaction(async (tx) => {
    const found = await first(
      tx
        .select({ payout: payouts, email: users.email, name: users.name })
        .from(payouts)
        .innerJoin(users, eq(users.id, payouts.partnerId))
        .where(eq(payouts.id, payoutId))
        .limit(1)
        .for("update", { of: payouts }),
    );
    if (!found) throw new UserFacingError("Payout not found.");
    if (found.payout.status === "paid") throw new UserFacingError("This payout is already marked as paid.");

    await tx.update(payouts).set({ status: "paid", paidAt: now, reference }).where(eq(payouts.id, payoutId));
    await tx.update(commissions).set({ status: "paid" }).where(eq(commissions.payoutId, payoutId));
    await audit(tx, { actorId: adminId, action: "payout.paid", entityId: payoutId, detail: reference });
    return found;
  });

  await getMailer().send({
    to: row.email,
    subject: "Your Corpus365 partner payout is on its way",
    text: `Hi ${row.name},\n\nWe have paid ${formatMoney(row.payout.amount, 2)} for ${row.payout.period}. Reference: ${reference}.`,
  });
}

export async function listPayouts(partnerId?: string) {
  return db
    .select({ payout: payouts, partnerName: users.name, partnerEmail: users.email, payoutUpi: partnerProfiles.payoutUpi })
    .from(payouts)
    .innerJoin(users, eq(users.id, payouts.partnerId))
    .leftJoin(partnerProfiles, eq(partnerProfiles.userId, payouts.partnerId))
    .where(partnerId ? eq(payouts.partnerId, partnerId) : undefined)
    .orderBy(desc(payouts.createdAt));
}
