import type { Totals } from "@/domain/pricing";
import { formatMoney } from "@/lib/format";

export function OrderSummary({ totals, fractionDigits = 0 }: { totals: Totals; fractionDigits?: number }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd className="tabular-nums">{formatMoney(totals.subtotal, fractionDigits)}</dd></div>
      <div className="flex justify-between"><dt className="text-ink-muted">GST (18%)</dt><dd className="tabular-nums">{formatMoney(totals.tax, fractionDigits)}</dd></div>
      <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(totals.total, fractionDigits)}</dd></div>
    </dl>
  );
}
