"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/server/auth/session";
import { HOME_FOR_ROLE } from "@/server/auth/guards";
import { rateLimit, resetRateLimit } from "@/server/auth/rate-limit";
import { readReferralCode } from "@/server/referral";
import * as users from "@/server/services/user.service";
import { findApprovedPartnerByCode } from "@/server/services/partner.service";
import {
  clientSignupSchema,
  fieldErrorsOf,
  forgotPasswordSchema,
  formToObject,
  loginSchema,
  partnerSignupSchema,
  resetPasswordSchema,
  safeNextPath,
  type ActionState,
} from "@/lib/validation";
import { attempt, clientIp } from "./helpers";

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formToObject(form));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { email, password, next } = parsed.data;

  const limiterKey = `login:${email}:${await clientIp()}`;
  const limit = rateLimit(limiterKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterSeconds / 60);
    return { ok: false, message: `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }

  const user = await users.authenticate(email, password);
  if (!user) return { ok: false, message: "That email and password don’t match an account." };

  resetRateLimit(limiterKey);
  await createSession(user.id);
  redirect(safeNextPath(next, HOME_FOR_ROLE[user.role]));
}

export async function clientSignupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = clientSignupSchema.safeParse(formToObject(form));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { next, ...input } = parsed.data;

  const referral = await readReferralCode();
  const partner = referral ? await findApprovedPartnerByCode(referral) : null;

  let userId = "";
  const result = await attempt(async () => {
    userId = (await users.registerClient({ ...input, referredByPartnerId: partner?.userId ?? null })).id;
  });
  if (!result.ok) return result;

  await createSession(userId);
  redirect(safeNextPath(next, "/account?welcome=1"));
}

export async function partnerSignupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = partnerSignupSchema.safeParse(formToObject(form));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const { agreement: _agreement, ...input } = parsed.data;

  let userId = "";
  const result = await attempt(async () => {
    userId = (await users.registerPartnerApplication(input)).id;
  });
  if (!result.ok) return result;

  await createSession(userId);
  redirect("/partner");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function forgotPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(formToObject(form));
  if (!parsed.success) return fieldErrorsOf(parsed.error);

  const limit = rateLimit(`reset:${await clientIp()}`, 5, 60 * 60_000);
  if (limit.allowed) await users.requestPasswordReset(parsed.data.email);
  // Same answer either way, so the form cannot be used to discover accounts.
  return { ok: true, message: "If an account exists for that email, we’ve sent a link to reset the password." };
}

export async function resetPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(formToObject(form));
  if (!parsed.success) return fieldErrorsOf(parsed.error);

  const result = await attempt(() => users.resetPassword(parsed.data.token, parsed.data.password));
  if (!result.ok) return result;
  redirect("/login?reset=1");
}
