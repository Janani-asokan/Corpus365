import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight", className)} aria-label="Corpus365 home">
      <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white">
        C
      </span>
      <span className={tone === "dark" ? "text-ink" : "text-paper"}>
        Corpus<span className="text-accent">365</span>
      </span>
    </Link>
  );
}
