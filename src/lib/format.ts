export { formatMoney } from "@/domain/money";

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const monthFormatter = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

export function formatDate(value: Date | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return dateFormatter.format(value);
}

/** "2026-11" -> "November 2026" */
export function formatPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return monthFormatter.format(new Date(year, month - 1, 1));
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-IN");
}

export function daysUntil(date: Date, now = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

const labels: Record<string, string> = {
  coming_soon: "Coming soon",
  quote_only: "Quote per site",
  in_payout: "In payout",
  launch_bonus: "Launch bonus",
  partner_bulk: "Partner bulk",
};

/** Human label for an enum value: "in_payout" -> "In payout". */
export function humanize(value: string): string {
  return labels[value] ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}
