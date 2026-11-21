"use client";

import { Form, useFormAction } from "@/components/ui/form";
import { createLeadAction, updateLeadStatusAction } from "@/server/actions/partner.actions";
import { LEAD_STATUSES, type LeadStatus } from "@/domain/constants";
import { humanize } from "@/lib/format";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function NewLeadForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, action] = useFormAction(createLeadAction);
  const errors = state.fieldErrors ?? {};

  return (
    <Form state={state} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" name="businessName" errors={errors.businessName}>
          {(p) => <Input {...p} required />}
        </Field>
        <Field label="Contact person" name="contactName" errors={errors.contactName}>
          {(p) => <Input {...p} required />}
        </Field>
        <Field label="Phone" name="phone" optional errors={errors.phone}>
          {(p) => <Input {...p} type="tel" />}
        </Field>
        <Field label="Email" name="email" optional errors={errors.email}>
          {(p) => <Input {...p} type="email" />}
        </Field>
      </div>
      <Field label="Interested in" name="productId" optional errors={errors.productId}>
        {(p) => (
          <Select {...p} defaultValue="">
            <option value="">Not sure yet</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Notes" name="notes" optional errors={errors.notes}>
        {(p) => <Textarea {...p} placeholder="e.g. Wants a demo after Onam" />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Add lead</SubmitButton>
    </Form>
  );
}

/** Changing the select saves immediately (progressively enhanced: works as a normal form too). */
export function LeadStatusSelect({ leadId, status, label }: { leadId: string; status: LeadStatus; label: string }) {
  return (
    <form action={updateLeadStatusAction} className="flex items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <label className="sr-only" htmlFor={`lead-${leadId}`}>Status for {label}</label>
      <Select id={`lead-${leadId}`} name="status" defaultValue={status} className="h-9 w-32" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {LEAD_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
      </Select>
      <noscript><button type="submit">Save</button></noscript>
    </form>
  );
}
