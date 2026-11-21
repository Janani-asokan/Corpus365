import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

const styles: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "bg-info-tint text-info border-info/20", Icon: Info },
  success: { box: "bg-brand-tint text-brand border-brand/20", Icon: CircleCheck },
  warning: { box: "bg-warning-tint text-warning border-warning/20", Icon: TriangleAlert },
  danger: { box: "bg-danger-tint text-danger border-danger/20", Icon: CircleAlert },
};

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  const { box, Icon } = styles[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-ink-soft")}>{children}</div>}
      </div>
    </div>
  );
}
