"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/guards";
import * as users from "@/server/services/user.service";
import { updatePayoutUpi } from "@/server/services/partner.service";
import {
  changePasswordSchema,
  fieldErrorsOf,
  formToObject,
  payoutSettingsSchema,
  profileSchema,
  type ActionState,
} from "@/lib/validation";
import { attempt } from "./helpers";

export async function updateProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(formToObject(form));
  if (!parsed.success) return fieldErrorsOf(parsed.error);

  const result = await attempt(() => users.updateProfile(user.id, parsed.data), "Profile saved.");
  revalidatePath("/", "layout");
  return result;
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse(formToObject(form));
  if (!parsed.success) return fieldErrorsOf(parsed.error);

  return attempt(
    () => users.changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword),
    "Password changed.",
  );
}

export async function updatePayoutAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["partner"]);
  const parsed = payoutSettingsSchema.safeParse(formToObject(form));
  if (!parsed.success) return fieldErrorsOf(parsed.error);

  const result = await attempt(() => updatePayoutUpi(user.id, parsed.data.payoutUpi), "Payout details saved.");
  revalidatePath("/settings");
  return result;
}
