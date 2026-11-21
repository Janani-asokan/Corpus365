import { describe, expect, it } from "vitest";
import { MIN_RENEWAL_SAMPLE, renewalRate, resolveTier, tierProgress } from "@/domain/tiers";

const perf = (activeClients: number, renewalsDue = 0, renewalsMade = 0) => ({ activeClients, renewalsDue, renewalsMade });

describe("resolveTier", () => {
  it.each([
    [0, "channel"],
    [9, "channel"],
    [10, "silver"],
    [24, "silver"],
    [25, "gold"],
    [49, "gold"],
    [50, "platinum"],
  ])("%i active clients -> %s (no renewal history yet)", (clients, tier) => {
    expect(resolveTier(perf(clients)).id).toBe(tier);
  });

  it("holds a partner at Silver when Gold's 80% renewal rate is missed", () => {
    expect(resolveTier(perf(30, 20, 15)).id).toBe("silver"); // 75%
  });

  it("promotes to Gold when the renewal rate is met", () => {
    expect(resolveTier(perf(30, 20, 16)).id).toBe("gold"); // 80%
  });

  it("requires 85% renewing for Platinum", () => {
    expect(resolveTier(perf(60, 100, 84)).id).toBe("gold");
    expect(resolveTier(perf(60, 100, 85)).id).toBe("platinum");
  });
});

describe("renewalRate", () => {
  it("is unknown until enough subscriptions have come up for renewal", () => {
    expect(renewalRate(perf(5, MIN_RENEWAL_SAMPLE - 1, 0))).toBeNull();
    expect(renewalRate(perf(5, MIN_RENEWAL_SAMPLE, MIN_RENEWAL_SAMPLE))).toBe(10_000);
  });
});

describe("tierProgress", () => {
  it("reports clients needed for the next tier", () => {
    const progress = tierProgress(perf(15));
    expect(progress.current.id).toBe("silver");
    expect(progress.next?.id).toBe("gold");
    expect(progress.clientsNeeded).toBe(10);
    expect(progress.percent).toBe(33);
  });

  it("is complete at the top tier", () => {
    expect(tierProgress(perf(80)).next).toBeNull();
  });
});
