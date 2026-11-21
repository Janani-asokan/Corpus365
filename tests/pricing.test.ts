import { describe, expect, it } from "vitest";
import { addInterval, computeTotals, unitPriceForQuantity, yearlySavingPercent } from "@/domain/pricing";
import { applyRate, formatMoney, rupees } from "@/domain/money";
import { safeNextPath } from "@/lib/validation";

describe("money", () => {
  it("rounds rates to the nearest paisa", () => {
    expect(applyRate(999, 1800)).toBe(180); // 179.82
  });
  it("formats rupees in the Indian numbering system", () => {
    expect(formatMoney(rupees(1_200_000))).toBe("₹12,00,000");
  });
});

describe("computeTotals", () => {
  it("adds 18% GST on the subtotal", () => {
    expect(computeTotals([rupees(10_000), rupees(2_000)])).toEqual({
      subtotal: rupees(12_000),
      tax: rupees(2_160),
      total: rupees(14_160),
    });
  });
});

describe("unitPriceForQuantity", () => {
  const tiers = [
    { minQuantity: 10, unitPrice: 300 },
    { minQuantity: 50, unitPrice: 250 },
    { minQuantity: 100, unitPrice: 200 },
  ];
  it("picks the best tier reached", () => {
    expect(unitPriceForQuantity(tiers, 9)).toBeNull();
    expect(unitPriceForQuantity(tiers, 10)).toBe(300);
    expect(unitPriceForQuantity(tiers, 99)).toBe(250);
    expect(unitPriceForQuantity(tiers, 500)).toBe(200);
  });
});

describe("billing periods", () => {
  it("adds months and years", () => {
    const start = new Date(2026, 0, 15);
    expect(addInterval(start, "month").getMonth()).toBe(1);
    expect(addInterval(start, "year").getFullYear()).toBe(2027);
  });
  it("computes yearly savings", () => {
    expect(yearlySavingPercent(rupees(1_200), rupees(12_000))).toBe(17);
  });
});

describe("safeNextPath", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath(undefined, "/partner")).toBe("/partner");
  });
});
