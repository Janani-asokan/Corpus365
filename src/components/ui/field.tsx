import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export { Input, Select, Textarea } from "./controls";

interface FieldProps {
  label: string;
  name: string;
  errors?: string[];
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  /** Render the control; receives the accessibility props to spread onto it. */
  children: (props: { id: string; name: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Label + control + hint + error, wired together for screen readers. */
export function Field({ label, name, errors, hint, optional, className, children }: FieldProps) {
  const id = `field-${name}`;
  const error = errors?.[0];
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-muted">(optional)</span>}
      </label>
      {children({ id, name, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
