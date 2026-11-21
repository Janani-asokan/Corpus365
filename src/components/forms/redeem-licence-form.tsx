"use client";

import { Form, useFormAction } from "@/components/ui/form";
import { redeemLicenceAction } from "@/server/actions/shop.actions";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function RedeemLicenceForm() {
  const [state, action] = useFormAction(redeemLicenceAction);
  return (
    <Form state={state} action={action} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field label="Licence key" name="key" errors={state.fieldErrors?.key} className="flex-1">
          {(p) => <Input {...p} placeholder="C365-XXXX-XXXX-XXXX-XXXX" className="font-mono uppercase" autoComplete="off" />}
        </Field>
        <SubmitButton className="sm:mt-7" pendingLabel="Activating…">Activate</SubmitButton>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}
