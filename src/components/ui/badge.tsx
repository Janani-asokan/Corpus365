import { cn } from "@/lib/cn";
import { humanize } from "@/lib/format";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const tones: Record<Tone, string> = {
  neutral: "bg-ink/5 text-ink-soft",
  success: "bg-brand-tint text-brand",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  info: "bg-info-tint text-info",
  brand: "bg-accent-tint text-ink",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

const statusTones: Record<string, Tone> = {
  active: "success",
  live: "success",
  paid: "success",
  approved: "success",
  won: "success",
  trialing: "info",
  trial: "info",
  demo: "info",
  in_payout: "info",
  quoted: "info",
  pending: "warning",
  open: "warning",
  new: "warning",
  contacted: "neutral",
  coming_soon: "neutral",
  quote_only: "brand",
  cancelled: "neutral",
  closed: "neutral",
  expired: "danger",
  failed: "danger",
  rejected: "danger",
  suspended: "danger",
  lost: "danger",
  reversed: "danger",
};

/** Badge for any enum status value, with a consistent colour per meaning. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={statusTones[status] ?? "neutral"}>{label ?? humanize(status)}</Badge>;
}
