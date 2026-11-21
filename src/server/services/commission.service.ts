import { and, count, eq } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { commissions } from "@/server/db/schema";
import { commissionForLine, qualifiesForLaunchBonus } from "@/domain/commission";
import { PROGRAM } from "@/domain/program";
import { currentTier, getPartnerProfile } from "./partner.service";

export interface PaidLine {
  productType: "app" | "hardware";
  netAmount: number;
  hardwareMargin: number | null;
  description: string;
  subscriptionId: string | null;
}

/**
 * Records the partner's commission for every line of a paid order. The tier is
 * evaluated at the time of sale, and the rate is stored on each record so later
 * tier changes never rewrite history.
 */
export function recordCommissions(
  tx: Executor,
  input: { orderId: string; partnerId: string; isRenewal: boolean; lines: PaidLine[]; now: Date },
): void {
  const profile = getPartnerProfile(input.partnerId, tx);
  if (!profile || profile.status !== "approved") return;

  const tier = currentTier(input.partnerId, tx);
  let previousAppSales = countAppSales(tx, input.partnerId);

  for (const line of input.lines) {
    const commission = commissionForLine(
      line.productType === "hardware"
        ? { type: "hardware", netAmount: line.netAmount, marginRate: line.hardwareMargin }
        : { type: "app", netAmount: line.netAmount, isRenewal: input.isRenewal },
      tier,
    );
    if (!commission) continue;

    tx.insert(commissions)
      .values({
        partnerId: input.partnerId,
        orderId: input.orderId,
        subscriptionId: line.subscriptionId,
        kind: commission.kind,
        description: line.description,
        baseAmount: commission.baseAmount,
        rate: commission.rate,
        amount: commission.amount,
        tier: tier.id,
        createdAt: input.now,
      })
      .run();

    if (commission.kind === "sale") {
      const bonus =
        profile.approvedAt &&
        qualifiesForLaunchBonus({ approvedAt: profile.approvedAt, saleAt: input.now, previousAppSales });
      if (bonus) {
        tx.insert(commissions)
          .values({
            partnerId: input.partnerId,
            orderId: input.orderId,
            subscriptionId: line.subscriptionId,
            kind: "launch_bonus",
            description: `Launch bonus · sale ${previousAppSales + 1} of ${PROGRAM.launchBonus.maxSales}`,
            baseAmount: 0,
            rate: 0,
            amount: PROGRAM.launchBonus.amount,
            tier: tier.id,
            createdAt: input.now,
          })
          .run();
      }
      previousAppSales += 1;
    }
  }
}

function countAppSales(tx: Executor, partnerId: string): number {
  return (
    tx
      .select({ value: count() })
      .from(commissions)
      .where(and(eq(commissions.partnerId, partnerId), eq(commissions.kind, "sale")))
      .get()?.value ?? 0
  );
}
