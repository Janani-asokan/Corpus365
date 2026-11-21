"use client";

import { Form, useFormAction } from "@/components/ui/form";
import { requestQuoteAction } from "@/server/actions/shop.actions";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function QuoteForm({ productId, defaults }: { productId: string; defaults?: { name?: string; email?: string; phone?: string | null; city?: string | null } }) {
  const [state, action] = useFormAction(requestQuoteAction);
  const errors = state.fieldErrors ?? {};

  if (state.ok) return <FormMessage state={state} />;

  return (
    <Form state={state} action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="name" errors={errors.name}>
          {(p) => <Input {...p} autoComplete="name" defaultValue={defaults?.name} required />}
        </Field>
        <Field label="Email" name="email" errors={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" defaultValue={defaults?.email} required />}
        </Field>
        <Field label="Phone" name="phone" errors={errors.phone}>
          {(p) => <Input {...p} type="tel" autoComplete="tel" defaultValue={defaults?.phone ?? ""} required />}
        </Field>
        <Field label="Site city" name="city" errors={errors.city}>
          {(p) => <Input {...p} autoComplete="address-level2" defaultValue={defaults?.city ?? ""} required />}
        </Field>
      </div>
      <Field label="What do you need?" name="message" optional errors={errors.message}>
        {(p) => <Textarea {...p} placeholder="e.g. two turnstiles at the main entrance" />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Sending…">Request a site quote</SubmitButton>
    </Form>
  );
}
