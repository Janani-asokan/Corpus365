"use client";

import { useId, useState } from "react";
import { estimateEarnings } from "@/domain/projection";
import { TIERS, resolveTier } from "@/domain/tiers";
import { formatMoney, rupees } from "@/domain/money";

const PRICES = [6_000, 12_000, 24_000];

/** Illustrative earnings, computed with the same rules the platform pays on. */
export function EarningsCalculator() {
  const id = useId();
  const [clients, setClients] = useState(25);
  const [price, setPrice] = useState(12_000);
  const [renewing, setRenewing] = useState(85);

  const tier = resolveTier({ activeClients: clients, renewalsDue: 0, renewalsMade: 0 });
  const estimate = estimateEarnings({ clients, yearlyPrice: rupees(price), tier: tier.id, renewingShare: renewing / 100 });

  return (
    <div className="grid gap-8 rounded-2xl bg-ink p-6 text-paper sm:p-8 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-6">
        <div>
          <label htmlFor={`${id}-clients`} className="flex justify-between text-sm font-medium">
            <span>Your active clients</span>
            <span className="font-display text-accent">{clients}</span>
          </label>
          <input id={`${id}-clients`} type="range" min={1} max={100} value={clients} onChange={(e) => setClients(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-accent)]" />
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Average app price per client per year</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PRICES.map((value) => (
              <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${price === value ? "border-accent bg-accent/10 text-accent" : "border-white/15 hover:border-white/30"}`}>
                <input type="radio" name={`${id}-price`} className="sr-only" checked={price === value} onChange={() => setPrice(value)} />
                {formatMoney(rupees(value))}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor={`${id}-renewing`} className="flex justify-between text-sm font-medium">
            <span>Clients renewing each year</span>
            <span className="font-display text-accent">{renewing}%</span>
          </label>
          <input id={`${id}-renewing`} type="range" min={50} max={100} step={5} value={renewing} onChange={(e) => setRenewing(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-accent)]" />
        </div>
      </div>

      <div className="space-y-4" aria-live="polite">
        <p className="text-sm text-paper/70">At this size you would be a <span className="font-semibold text-white">{tier.name}</span>.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border-t-4 border-accent bg-ink-soft p-4">
            <p className="font-display text-3xl font-bold text-accent">{formatMoney(estimate.firstYear)}</p>
            <p className="mt-1 text-sm text-paper/80">earned on first sales</p>
          </div>
          <div className="rounded-xl border-t-4 border-accent bg-ink-soft p-4">
            <p className="font-display text-3xl font-bold text-accent">{formatMoney(estimate.yearlyRenewals)}</p>
            <p className="mt-1 text-sm text-paper/80">every year from renewals</p>
          </div>
        </div>
        <p className="text-xs text-paper/60">
          Illustrative only: before bonuses and any service fees you charge. Rates: {TIERS.map((t) => t.name.split(" ")[0]).join(" / ")} tiers as published. Actual earnings depend entirely on your own sales.
        </p>
      </div>
    </div>
  );
}
