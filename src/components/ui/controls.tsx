"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { useSubmittedValue } from "./form";

const control =
  "block w-full rounded-lg border border-line-strong bg-white px-3 text-base text-ink placeholder:text-ink-muted/70 " +
  "transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20 disabled:bg-paper sm:text-sm";

export function Input({ className, defaultValue, ...props }: ComponentProps<"input">) {
  const submitted = useSubmittedValue(props.name);
  return <input className={cn(control, "h-11", className)} defaultValue={submitted ?? defaultValue} {...props} />;
}

export function Select({ className, defaultValue, ...props }: ComponentProps<"select">) {
  const submitted = useSubmittedValue(props.name);
  const value = props.value !== undefined ? undefined : (submitted ?? defaultValue);
  return <select className={cn(control, "h-11 pr-8", className)} defaultValue={value} {...props} />;
}

export function Textarea({ className, defaultValue, ...props }: ComponentProps<"textarea">) {
  const submitted = useSubmittedValue(props.name);
  return <textarea className={cn(control, "min-h-24 py-2.5", className)} defaultValue={submitted ?? defaultValue} {...props} />;
}
