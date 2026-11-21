"use client";

import { useActionState, useMemo, useState } from "react";
import { placeBulkOrderAction } from "@/server/actions/partner.actions";
import { initialActionState } from "@/lib/validation";
import { computeTotals, unitPriceForQuantity, type PriceTier } from "@/domain/pricing";
import { formatMoney } from "@/domain/money";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { ProductIcon } from "@/components/ui/product-icon";
import { OrderSummary } from "@/components/catalog/order-summary";

export interface BulkItem {
  id: string;
  name: string;
  type: "app" | "hardware";
  icon: string;
  retailPrice: number | null;
  minQuantity: number;
  tiers: PriceTier[];
}

/** Bulk order sheet with live volume pricing (the server re-prices on submit). */
export function BulkOrderForm({ items, disabled }: { items: BulkItem[]; disabled: boolean }) {
  const [state, action] = useActionState(placeBulkOrderAction, initialActionState);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const lines = useMemo(
    () =>
      items.map((item) => {
        const quantity = quantities[item.id] ?? 0;
        const unit = quantity > 0 ? unitPriceForQuantity(item.tiers, quantity) : null;
        return { item, quantity, unit, total: unit ? unit * quantity : 0, belowMinimum: quantity > 0 && unit === null };
      }),
    [items, quantities],
  );
  const totals = computeTotals(lines.map((l) => l.total));
  const hasErrors = lines.some((l) => l.belowMinimum);

  return (
    <form action={action}>
      <ul className="divide-y divide-line">
        {lines.map(({ item, quantity, unit, total, belowMinimum }) => (
          <li key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <ProductIcon icon={item.icon} type={item.type} size="sm" />
            <div className="min-w-48 flex-1">
              <p className="font-medium">{item.name}{item.type === "app" && <span className="font-normal text-ink-muted"> · 1-year licences</span>}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-muted">
                {item.tiers.map((tier) => (
                  <span key={tier.minQuantity}>{tier.minQuantity}+ @ {formatMoney(tier.unitPrice)}</span>
                ))}
                {item.retailPrice && <span>· retail {formatMoney(item.retailPrice)}</span>}
              </p>
              {belowMinimum && <p className="mt-1 text-xs font-medium text-danger">Minimum {item.minQuantity} units</p>}
            </div>
            <div className="w-24">
              <label htmlFor={`qty-${item.id}`} className="sr-only">Quantity of {item.name}</label>
              <Input
                id={`qty-${item.id}`}
                name={`qty:${item.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={1000}
                placeholder="0"
                value={quantity || ""}
                onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: Math.max(0, Number(e.target.value) || 0) }))}
                className="h-9"
                disabled={disabled}
                aria-invalid={belowMinimum}
              />
            </div>
            <p className="w-28 text-right text-sm tabular-nums">
              {unit ? <><span className="font-medium">{formatMoney(total)}</span><span className="block text-xs text-ink-muted">{formatMoney(unit)} each</span></> : "—"}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-4 border-t border-line p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-xs"><OrderSummary totals={totals} /></div>
        <div className="space-y-2 sm:text-right">
          <FormMessage state={state} />
          <SubmitButton size="lg" disabled={disabled || totals.subtotal === 0 || hasErrors} pendingLabel="Placing order…">
            Place order · {formatMoney(totals.total)}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
