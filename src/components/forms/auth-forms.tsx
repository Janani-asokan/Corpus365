"use client";

import { Form, useFormAction } from "@/components/ui/form";
import Link from "next/link";
import {
  clientSignupAction,
  forgotPasswordAction,
  loginAction,
  partnerSignupAction,
  resetPasswordAction,
} from "@/server/actions/auth.actions";
import { PROFESSIONS } from "@/lib/validation";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useFormAction(loginAction);
  const errors = state.fieldErrors ?? {};
  return (
    <Form state={state} action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" name="email" errors={errors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" required autoFocus />}
      </Field>
      <Field
        label="Password"
        name="password"
        errors={errors.password}
        hint={<Link href="/forgot-password" className="font-medium text-brand hover:underline">Forgot your password?</Link>}
      >
        {(p) => <Input {...p} type="password" autoComplete="current-password" required />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
    </Form>
  );
}

export function ClientSignupForm({ next }: { next?: string }) {
  const [state, action] = useFormAction(clientSignupAction);
  const errors = state.fieldErrors ?? {};
  return (
    <Form state={state} action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="name" errors={errors.name}>
          {(p) => <Input {...p} autoComplete="name" required />}
        </Field>
        <Field label="Business name" name="companyName" errors={errors.companyName}>
          {(p) => <Input {...p} autoComplete="organization" required />}
        </Field>
        <Field label="Phone" name="phone" errors={errors.phone}>
          {(p) => <Input {...p} type="tel" autoComplete="tel" placeholder="+91 98470 12345" required />}
        </Field>
        <Field label="City" name="city" errors={errors.city}>
          {(p) => <Input {...p} autoComplete="address-level2" required />}
        </Field>
      </div>
      <Field label="Work email" name="email" errors={errors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" required />}
      </Field>
      <Field label="Password" name="password" errors={errors.password} hint={PASSWORD_HINT}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Creating account…">Create business account</SubmitButton>
    </Form>
  );
}

export function PartnerApplicationForm() {
  const [state, action] = useFormAction(partnerSignupAction);
  const errors = state.fieldErrors ?? {};
  return (
    <Form state={state} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name" errors={errors.name}>
          {(p) => <Input {...p} autoComplete="name" required />}
        </Field>
        <Field label="Phone" name="phone" errors={errors.phone}>
          {(p) => <Input {...p} type="tel" autoComplete="tel" placeholder="+91 98470 12345" required />}
        </Field>
        <Field label="City" name="city" errors={errors.city}>
          {(p) => <Input {...p} autoComplete="address-level2" required />}
        </Field>
        <Field label="State / region" name="region" errors={errors.region}>
          {(p) => <Input {...p} autoComplete="address-level1" placeholder="Kerala" required />}
        </Field>
      </div>
      <Field label="What best describes you?" name="profession" errors={errors.profession}>
        {(p) => (
          <Select {...p} defaultValue="" required>
            <option value="" disabled>Choose one</option>
            {PROFESSIONS.map((profession) => <option key={profession}>{profession}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Tell us about the businesses you work with" name="experience" optional errors={errors.experience}>
        {(p) => <Textarea {...p} placeholder="e.g. I do accounts for 30 shops and two gyms in Thrissur." />}
      </Field>
      <Field label="Email" name="email" errors={errors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" required />}
      </Field>
      <Field label="Password" name="password" errors={errors.password} hint={PASSWORD_HINT}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
      </Field>
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="agreement" defaultChecked={state.values?.agreement === "on"} className="mt-0.5 size-4 accent-[var(--color-brand)]" aria-invalid={Boolean(errors.agreement)} aria-describedby={errors.agreement ? "agreement-error" : undefined} />
          <span>
            I have read and accept the{" "}
            <Link href="/legal/partner-agreement" target="_blank" className="font-medium text-brand underline">Channel Partner agreement</Link>. I understand there is no fee to join and I earn only on software and hardware I sell.
          </span>
        </label>
        {errors.agreement && <p id="agreement-error" className="mt-1 text-xs font-medium text-danger">{errors.agreement[0]}</p>}
      </div>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Submitting…">Submit application</SubmitButton>
    </Form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useFormAction(forgotPasswordAction);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <Form state={state} action={action} className="space-y-4">
      <Field label="Email" name="email" errors={state.fieldErrors?.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" required autoFocus />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Sending…">Send reset link</SubmitButton>
    </Form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useFormAction(resetPasswordAction);
  const errors = state.fieldErrors ?? {};
  return (
    <Form state={state} action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" errors={errors.password} hint={PASSWORD_HINT}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required autoFocus />}
      </Field>
      <Field label="Confirm new password" name="confirmPassword" errors={errors.confirmPassword}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" required />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Saving…">Set new password</SubmitButton>
    </Form>
  );
}
