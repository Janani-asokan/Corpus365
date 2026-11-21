import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Horizontally scrollable on small screens so wide tables never break the layout. */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="relative -mx-px overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn("border-b border-line bg-paper/60 px-4 py-2.5 text-xs font-semibold tracking-wide text-ink-muted uppercase whitespace-nowrap", className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-line/70 px-4 py-3 align-middle", className)} {...props} />;
}
