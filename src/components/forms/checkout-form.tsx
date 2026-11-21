"use client";

import { Form, useFormAction } from "@/components/ui/form";
import { Lock } from "lucide-react";
import { checkoutAction } from "@/server/actions/shop.actions";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function CheckoutForm({
  defaults,
  totalLabel,
  partner,
}: {
  defaults: { billingName: string; billingCompany: string | null };
  totalLabel: string;
  /** Partner already credited (from the account or a referral link), if known. */
  partner: { code: string; name: string; locked: boolean } | null;
}) {
  const [state, action] = useFormAction(checkoutAction);
  const errors = state.fieldErrors ?? {};

  return (
    <Form state={state} action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Billing name" name="billingName" errors={errors.billingName}>
          {(p) => <Input {...p} autoComplete="name" defaultValue={defaults.billingName} required />}
        </Field>
        <Field label="Business name" name="billingCompany" optional errors={errors.billingCompany}>
          {(p) => <Input {...p} autoComplete="organization" defaultValue={defaults.billingCompany ?? ""} />}
        </Field>
      </div>
      <Field label="GSTIN" name="billingGstin" optional errors={errors.billingGstin} hint="Add your GSTIN to claim input tax credit.">
        {(p) => <Input {...p} placeholder="29ABCDE1234F1Z5" maxLength={15} className="uppercase" />}
      </Field>

      {partner?.locked ? (
        <p className="rounded-lg bg-brand-tint px-4 py-3 text-sm text-brand">
          Your Corpus365 partner is <span className="font-semibold">{partner.name}</span>. They’ll help you set up.
        </p>
      ) : (
        <Field
          label="Partner code"
          name="partnerCode"
          optional
          errors={errors.partnerCode}
          hint={partner ? `Referred by ${partner.name}. Leave as is, or enter a different code.` : "Did a Corpus365 partner help you? Enter their code so they can support you."}
        >
          {(p) => <Input {...p} defaultValue={partner?.code ?? ""} className="uppercase" maxLength={20} autoComplete="off" />}
        </Field>
      )}

      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Processing payment…">
        <Lock className="size-4" aria-hidden /> Pay {totalLabel}
      </SubmitButton>
    </Form>
  );
}
