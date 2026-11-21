import { describe, expect, it } from "vitest";
import { commissionForLine, qualifiesForLaunchBonus } from "@/domain/commission";
import { getTier } from "@/domain/tiers";
import { rupees } from "@/domain/money";
import { estimateEarnings } from "@/domain/projection";

describe("commissionForLine", () => {
  it("matches the brief's worked example for a Gold partner", () => {
    const gold = getTier("gold");
    const sale = commissionForLine({ type: "app", netAmount: rupees(12_000), isRenewal: false }, gold);
    const renewal = commissionForLine({ type: "app", netAmount: rupees(12_000), isRenewal: true }, gold);
    expect(sale).toMatchObject({ kind: "sale", amount: rupees(3_600), rate: 3000 });
    expect(renewal).toMatchObject({ kind: "renewal", amount: rupees(1_800), rate: 1500 });
  });

  it("uses the tier's rates", () => {
    const line = { type: "app" as const, netAmount: rupees(10_000), isRenewal: false };
    expect(commissionForLine(line, getTier("channel"))?.amount).toBe(rupees(2_000));
    expect(commissionForLine(line, getTier("platinum"))?.amount).toBe(rupees(3_500));
  });

  it("pays hardware a one-time margin independent of tier", () => {
    const line = { type: "hardware" as const, netAmount: rupees(20_000), marginRate: 1200 };
    expect(commissionForLine(line, getTier("channel"))).toMatchObject({ kind: "hardware", amount: rupees(2_400) });
    expect(commissionForLine({ ...line, marginRate: null }, getTier("gold"))?.amount).toBe(rupees(2_000));
  });

  it("ignores zero-value lines", () => {
    expect(commissionForLine({ type: "app", netAmount: 0, isRenewal: false }, getTier("gold"))).toBeNull();
  });
});

describe("qualifiesForLaunchBonus", () => {
  const approvedAt = new Date("2026-01-01T00:00:00Z");
  it("rewards the first three sales within 60 days", () => {
    expect(qualifiesForLaunchBonus({ approvedAt, saleAt: new Date("2026-02-01"), previousAppSales: 2 })).toBe(true);
    expect(qualifiesForLaunchBonus({ approvedAt, saleAt: new Date("2026-02-01"), previousAppSales: 3 })).toBe(false);
    expect(qualifiesForLaunchBonus({ approvedAt, saleAt: new Date("2026-03-15"), previousAppSales: 0 })).toBe(false);
  });
});

describe("estimateEarnings", () => {
  it("reproduces the brief: 50 Gold clients renewing earn ₹90,000 a year", () => {
    const estimate = estimateEarnings({ clients: 50, yearlyPrice: rupees(12_000), tier: "gold", renewingShare: 1 });
    expect(estimate.yearlyRenewals).toBe(rupees(90_000));
    expect(estimate.firstYear).toBe(rupees(180_000));
  });
});
