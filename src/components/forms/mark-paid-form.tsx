"use client";

import { useActionState } from "react";
import { markPayoutPaidAction } from "@/server/actions/admin.actions";
import { initialActionState } from "@/lib/validation";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function MarkPaidForm({ payoutId }: { payoutId: string }) {
  const [state, action] = useActionState(markPayoutPaidAction, initialActionState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="payoutId" value={payoutId} />
      <label htmlFor={`ref-${payoutId}`} className="sr-only">Transfer reference</label>
      <Input id={`ref-${payoutId}`} name="reference" placeholder="UPI / bank reference" className="h-9 w-48" required />
      <SubmitButton size="sm" pendingLabel="Saving…">Mark paid</SubmitButton>
      {state.message && <p className={`w-full text-xs ${state.ok ? "text-brand" : "text-danger"}`} role="status">{state.message}</p>}
    </form>
  );
}
