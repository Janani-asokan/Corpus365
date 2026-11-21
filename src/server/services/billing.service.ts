import { and, eq, lte } from "drizzle-orm";
import { db } from "@/server/db/client";
import { orders, subscriptions } from "@/server/db/schema";
import { PROGRAM } from "@/domain/program";
import { addDays } from "@/domain/pricing";
import { createRenewalOrder, pendingRenewalOrder } from "./order.service";
import { billByLink } from "./payment.service";

export interface BillingRunResult {
  renewed: number;
  linksSent: number;
  lapsed: number;
  cancelled: number;
  trialsEnded: number;
  failed: number;
}

/**
 * The daily billing job. Ends lapsed trials, honours cancellations, and bills
 * every subscription that has reached its period end. Razorpay cannot charge a
 * customer who isn't present without a mandate, so renewals go out as payment
 * links; the subscription stays active for a grace period while unpaid, then
 * lapses. Safe to run repeatedly and concurrently: the database allows only one
 * open renewal order per subscription.
 */
export async function processDueRenewals(now = new Date()): Promise<BillingRunResult> {
  const result: BillingRunResult = { renewed: 0, linksSent: 0, lapsed: 0, cancelled: 0, trialsEnded: 0, failed: 0 };

  result.trialsEnded = (
    await db
      .update(subscriptions)
      .set({ status: "expired" })
      .where(and(eq(subscriptions.status, "trialing"), lte(subscriptions.currentPeriodEnd, now)))
      .returning({ id: subscriptions.id })
  ).length;

  result.cancelled = (
    await db
      .update(subscriptions)
      .set({ status: "cancelled" })
      .where(and(eq(subscriptions.status, "active"), eq(subscriptions.cancelAtPeriodEnd, true), lte(subscriptions.currentPeriodEnd, now)))
      .returning({ id: subscriptions.id })
  ).length;

  const due = await db
    .select({ id: subscriptions.id, periodEnd: subscriptions.currentPeriodEnd })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, "active"), lte(subscriptions.currentPeriodEnd, now)));

  for (const sub of due) {
    try {
      const outstanding = await pendingRenewalOrder(sub.id);
      if (outstanding) {
        if (addDays(sub.periodEnd, PROGRAM.renewalGraceDays) <= now) {
          await db.transaction(async (tx) => {
            await tx.update(subscriptions).set({ status: "expired" }).where(eq(subscriptions.id, sub.id));
            await tx.update(orders).set({ status: "failed" }).where(eq(orders.id, outstanding.id));
          });
          result.lapsed += 1;
        }
        continue; // still within grace: the client already has a link
      }

      const { order, payer, description } = await createRenewalOrder(sub.id, now);
      const outcome = await billByLink(order, payer, description, now);
      if (outcome === "paid") result.renewed += 1;
      else result.linksSent += 1;
    } catch (error) {
      console.error(`[billing] subscription ${sub.id} could not be billed`, error);
      result.failed += 1;
    }
  }
  return result;
}
