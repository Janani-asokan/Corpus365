import type { TierProgress as Progress } from "@/domain/tiers";
import { bpsToPercent } from "@/domain/money";
import { Card } from "@/components/ui/card";

export function TierProgressCard({ progress, renewalRate }: { progress: Progress; renewalRate: number | null }) {
  const { current, next } = progress;
  return (
    <Card className="p-5">
      <p className="eyebrow">Your tier</p>
      <h2 className="mt-1 text-xl font-semibold">{current.name}</h2>
      <p className="mt-1 text-sm font-medium text-brand">{bpsToPercent(current.saleRate)} on sale · {bpsToPercent(current.renewalRate)} on renewal</p>

      {next ? (
        <div className="mt-5">
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Progress to {next.name.replace(" Channel Partner", "")}</span>
            <span className="font-medium">{progress.percent}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress to ${next.name}`}>
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            {progress.clientsNeeded > 0 ? `${progress.clientsNeeded} more active client${progress.clientsNeeded === 1 ? "" : "s"}` : "Client target reached"}
            {next.minRenewalRate && ` and ${bpsToPercent(next.minRenewalRate)}+ renewing`} to earn {bpsToPercent(next.saleRate)} / {bpsToPercent(next.renewalRate)}.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">You’re at the top tier. Thank you!</p>
      )}
      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-muted">
        Renewal rate: {renewalRate === null ? "not enough renewals yet to measure" : bpsToPercent(renewalRate)}
      </p>
    </Card>
  );
}
