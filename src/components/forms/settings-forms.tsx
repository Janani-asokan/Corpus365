"use client";

import { Form, useFormAction } from "@/components/ui/form";
import { changePasswordAction, updatePayoutAction, updateProfileAction } from "@/server/actions/account.actions";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function ProfileForm({ defaults, showCompany }: { defaults: { name: string; email: string; phone: string | null; companyName: string | null; city: string | null }; showCompany: boolean }) {
  const [state, action] = useFormAction(updateProfileAction);
  const errors = state.fieldErrors ?? {};
  return (
    <Form state={state} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name" errors={errors.name}>
          {(p) => <Input {...p} defaultValue={defaults.name} autoComplete="name" required />}
        </Field>
        <Field label="Email" name="email" hint="Contact support to change your sign-in email.">
          {(p) => <Input {...p} defaultValue={defaults.email} disabled />}
        </Field>
        <Field label="Phone" name="phone" optional errors={errors.phone}>
          {(p) => <Input {...p} type="tel" defaultValue={defaults.phone ?? ""} autoComplete="tel" />}
        </Field>
        <Field label="City" name="city" optional errors={errors.city}>
          {(p) => <Input {...p} defaultValue={defaults.city ?? ""} autoComplete="address-level2" />}
        </Field>
        {showCompany && (
          <Field label="Business name" name="companyName" optional errors={errors.companyName} className="sm:col-span-2">
            {(p) => <Input {...p} defaultValue={defaults.companyName ?? ""} autoComplete="organization" />}
          </Field>
        )}
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </Form>
  );
}

export function PasswordForm() {
  const [state, action] = useFormAction(changePasswordAction);
  const errors = state.fieldErrors ?? {};
  return (
    <Form state={state} action={action} className="space-y-4">
      <Field label="Current password" name="currentPassword" errors={errors.currentPassword}>
        {(p) => <Input {...p} type="password" autoComplete="current-password" required />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" name="newPassword" errors={errors.newPassword} hint="At least 8 characters, with a letter and a number.">
          {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
        </Field>
        <Field label="Confirm new password" name="confirmPassword" errors={errors.confirmPassword}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Change password</SubmitButton>
    </Form>
  );
}

export function PayoutForm({ upi }: { upi: string | null }) {
  const [state, action] = useFormAction(updatePayoutAction);
  return (
    <Form state={state} action={action} className="space-y-4">
      <Field label="UPI ID" name="payoutUpi" errors={state.fieldErrors?.payoutUpi} hint="Commission is paid here every month.">
        {(p) => <Input {...p} defaultValue={upi ?? ""} placeholder="yourname@bank" autoComplete="off" required />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Save payout details</SubmitButton>
    </Form>
  );
}
