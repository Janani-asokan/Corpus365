import {
  Boxes,
  DoorOpen,
  Dumbbell,
  Fingerprint,
  GraduationCap,
  Laptop,
  Monitor,
  Package,
  Printer,
  Receipt,
  ScanBarcode,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

const icons: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  receipt: Receipt,
  boxes: Boxes,
  printer: Printer,
  tag: Tag,
  "scan-barcode": ScanBarcode,
  fingerprint: Fingerprint,
  monitor: Monitor,
  "door-open": DoorOpen,
  laptop: Laptop,
};

/** Illustrated product tile (device photos follow once suppliers are chosen). */
export function ProductIcon({ icon, type, size = "md", className }: { icon: string; type: "app" | "hardware"; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = icons[icon] ?? Package;
  const box = { sm: "size-10 rounded-lg", md: "size-14 rounded-xl", lg: "size-24 rounded-2xl" }[size];
  const glyph = { sm: "size-5", md: "size-7", lg: "size-12" }[size];
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        type === "app" ? "bg-ink text-accent" : "bg-brand-tint text-brand",
        box,
        className,
      )}
    >
      <Icon className={glyph} strokeWidth={1.75} />
    </div>
  );
}
