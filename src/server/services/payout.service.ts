import { and, desc, eq, lte, sum } from "drizzle-orm";
import { db } from "@/server/db/client";
import { commissions, payouts, users } from "@/server/db/schema";
import { PROGRAM } from "@/domain/program";
import { addDays } from "@/domain/pricing";
import { formatMoney } from "@/domain/money";
import { getMailer } from "@/server/mail/mailer";
import { UserFacingError } from "@/lib/errors";
import { audit } from "./audit.service";

export function periodOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Monthly payout run: bundles each partner's cleared commissions (older than
 * the refund window) into one payout. Commissions move to "in_payout" so they
 * can never be paid twice.
 */
export function generatePayouts(adminId: string, now = new Date()): { created: number; total: number } {
  const clearedBefore = addDays(now, -PROGRAM.clearanceDays);
  const period = periodOf(now);

  return db.transaction((tx) => {
    const due = tx
      .select({ partnerId: commissions.partnerId, amount: sum(commissions.amount) })
      .from(commissions)
      .where(and(eq(commissions.status, "pending"), lte(commissions.createdAt, clearedBefore)))
      .groupBy(commissions.partnerId)
      .all();

    let created = 0;
    let total = 0;
    for (const row of due) {
      const amount = Number(row.amount ?? 0);
      if (amount <= 0) continue;
      const payout = tx.insert(payouts).values({ partnerId: row.partnerId, period, amount }).returning().get();
      tx.update(commissions)
        .set({ status: "in_payout", payoutId: payout.id })
        .where(
          and(
            eq(commissions.partnerId, row.partnerId),
            eq(commissions.status, "pending"),
            lte(commissions.createdAt, clearedBefore),
          ),
        )
        .run();
      created += 1;
      total += amount;
    }
    audit(tx, { actorId: adminId, action: "payouts.generated", detail: `${created} payouts for ${period}` });
    return { created, total };
  });
}

export async function markPayoutPaid(adminId: string, payoutId: string, reference: string): Promise<void> {
  const row = db
    .select({ payout: payouts, email: users.email, name: users.name })
    .from(payouts)
    .innerJoin(users, eq(users.id, payouts.partnerId))
    .where(eq(payouts.id, payoutId))
    .get();
  if (!row) throw new UserFacingError("Payout not found.");
  if (row.payout.status === "paid") throw new UserFacingError("This payout is already marked as paid.");

  const now = new Date();
  db.transaction((tx) => {
    tx.update(payouts).set({ status: "paid", paidAt: now, reference }).where(eq(payouts.id, payoutId)).run();
    tx.update(commissions).set({ status: "paid" }).where(eq(commissions.payoutId, payoutId)).run();
    audit(tx, { actorId: adminId, action: "payout.paid", entityId: payoutId, detail: reference });
  });

  await getMailer().send({
    to: row.email,
    subject: "Your Corpus365 partner payout is on its way",
    text: `Hi ${row.name},\n\nWe have paid ${formatMoney(row.payout.amount, 2)} for ${row.payout.period}. Reference: ${reference}.`,
  });
}

export function listPayouts(partnerId?: string) {
  return db
    .select({ payout: payouts, partnerName: users.name, partnerEmail: users.email })
    .from(payouts)
    .innerJoin(users, eq(users.id, payouts.partnerId))
    .where(partnerId ? eq(payouts.partnerId, partnerId) : undefined)
    .orderBy(desc(payouts.createdAt))
    .all();
}
