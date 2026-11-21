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
 * lapses. Safe to run repeatedly: one outstanding link per subscription.
 */
export async function processDueRenewals(now = new Date()): Promise<BillingRunResult> {
  const result: BillingRunResult = { renewed: 0, linksSent: 0, lapsed: 0, cancelled: 0, trialsEnded: 0, failed: 0 };

  result.trialsEnded = db
    .update(subscriptions)
    .set({ status: "expired" })
    .where(and(eq(subscriptions.status, "trialing"), lte(subscriptions.currentPeriodEnd, now)))
    .run().changes;

  result.cancelled = db
    .update(subscriptions)
    .set({ status: "cancelled" })
    .where(and(eq(subscriptions.status, "active"), eq(subscriptions.cancelAtPeriodEnd, true), lte(subscriptions.currentPeriodEnd, now)))
    .run().changes;

  const due = db
    .select({ id: subscriptions.id, periodEnd: subscriptions.currentPeriodEnd })
    .from(subscriptions)
    .where(and(eq(subscriptions.status, "active"), lte(subscriptions.currentPeriodEnd, now)))
    .all();

  for (const sub of due) {
    const outstanding = pendingRenewalOrder(sub.id);
    if (outstanding) {
      if (addDays(sub.periodEnd, PROGRAM.renewalGraceDays) <= now) {
        db.transaction((tx) => {
          tx.update(subscriptions).set({ status: "expired" }).where(eq(subscriptions.id, sub.id)).run();
          tx.update(orders).set({ status: "failed" }).where(eq(orders.id, outstanding.id)).run();
        });
        result.lapsed += 1;
      }
      continue; // still within grace: the client already has a link
    }

    try {
      const { order, payer, description } = createRenewalOrder(sub.id, now);
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
