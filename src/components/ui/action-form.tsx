"use client";

import { useActionState, type ReactNode } from "react";
import { initialActionState, type ActionState } from "@/lib/validation";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";
import type { ComponentProps } from "react";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/**
 * A compact form for single-button mutations (renew, approve, …) that shows
 * the action's result inline. Hidden inputs go in `children`.
 */
export function ActionForm({
  action,
  label,
  pendingLabel,
  variant,
  size = "sm",
  children,
  className,
  confirm,
}: {
  action: Action;
  label: string;
  pendingLabel?: string;
  variant?: ComponentProps<typeof SubmitButton>["variant"];
  size?: ComponentProps<typeof SubmitButton>["size"];
  children?: ReactNode;
  className?: string;
  /** Ask before submitting (for destructive or costly actions). */
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel}>
          {label}
        </SubmitButton>
      </div>
      {state.message && (
        <div className="mt-2">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}
