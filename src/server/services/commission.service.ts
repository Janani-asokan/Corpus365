import { and, count, eq } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { first } from "@/server/db/query";
import { commissions } from "@/server/db/schema";
import { commissionForLine, qualifiesForLaunchBonus } from "@/domain/commission";
import { PROGRAM } from "@/domain/program";
import { currentTier, getPartnerProfile } from "./partner.service";

export interface PaidLine {
  orderItemId: string;
  productType: "app" | "hardware";
  netAmount: number;
  hardwareMargin: number | null;
  description: string;
  subscriptionId: string | null;
}

/**
 * Records the partner's commission for every line of a paid order. The tier is
 * evaluated at the time of sale and stored on each record, so later tier
 * changes never rewrite history. The (order_item_id, kind) unique constraint
 * makes this safe to call more than once.
 */
export async function recordCommissions(
  tx: Executor,
  input: { orderId: string; partnerId: string; isRenewal: boolean; lines: PaidLine[]; now: Date },
): Promise<void> {
  const profile = await getPartnerProfile(input.partnerId, tx);
  if (!profile || profile.status !== "approved") return;

  const tier = await currentTier(input.partnerId, tx);
  let previousAppSales = await countAppSales(tx, input.partnerId);

  for (const line of input.lines) {
    const commission = commissionForLine(
      line.productType === "hardware"
        ? { type: "hardware", netAmount: line.netAmount, marginRate: line.hardwareMargin }
        : { type: "app", netAmount: line.netAmount, isRenewal: input.isRenewal },
      tier,
    );
    if (!commission) continue;

    const base = { partnerId: input.partnerId, orderId: input.orderId, orderItemId: line.orderItemId, subscriptionId: line.subscriptionId, tier: tier.id, createdAt: input.now };
    await tx
      .insert(commissions)
      .values({ ...base, kind: commission.kind, description: line.description, baseAmount: commission.baseAmount, rate: commission.rate, amount: commission.amount })
      .onConflictDoNothing({ target: [commissions.orderItemId, commissions.kind] });

    if (commission.kind !== "sale") continue;
    if (profile.approvedAt && qualifiesForLaunchBonus({ approvedAt: profile.approvedAt, saleAt: input.now, previousAppSales })) {
      await tx
        .insert(commissions)
        .values({
          ...base,
          kind: "launch_bonus",
          description: `Launch bonus · sale ${previousAppSales + 1} of ${PROGRAM.launchBonus.maxSales}`,
          baseAmount: 0,
          rate: 0,
          amount: PROGRAM.launchBonus.amount,
        })
        .onConflictDoNothing({ target: [commissions.orderItemId, commissions.kind] });
    }
    previousAppSales += 1;
  }
}

async function countAppSales(tx: Executor, partnerId: string): Promise<number> {
  const row = await first(tx.select({ value: count() }).from(commissions).where(and(eq(commissions.partnerId, partnerId), eq(commissions.kind, "sale"))));
  return row?.value ?? 0;
}
