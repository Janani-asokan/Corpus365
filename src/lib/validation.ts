import { z } from "zod";

/** Result shape every form server action returns to `useActionState`. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  /** What the user submitted, echoed back on failure (never passwords). */
  values?: Record<string, string>;
};

export const initialActionState: ActionState = {};

export function fieldErrorsOf(error: z.ZodError): ActionState {
  return {
    ok: false,
    message: "Please check the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors as ActionState["fieldErrors"],
  };
}

/** Converts FormData into a plain object (single values; checkboxes become "on"). */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max).transform((v) => (v === "" ? null : v)).nullable().optional();

export const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{7,16}$/, "Enter a valid phone number.");

export const name = trimmed(80).min(2, "Enter your full name.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export const clientSignupSchema = z.object({
  name,
  email,
  password,
  companyName: trimmed(120).min(2, "Enter your business name."),
  phone,
  city: trimmed(80).min(2, "Enter your city."),
  next: z.string().optional(),
});

export const PROFESSIONS = [
  "Accountant / bookkeeper",
  "IT shop / reseller",
  "Business consultant",
  "Freelancer",
  "Student",
  "Other",
] as const;

export const partnerSignupSchema = z.object({
  name,
  email,
  password,
  phone,
  city: trimmed(80).min(2, "Enter your city."),
  region: trimmed(80).min(2, "Enter your state or region."),
  profession: z.enum(PROFESSIONS, { error: "Choose what best describes you." }),
  experience: optionalText(600),
  agreement: z.literal("on", { error: "You must accept the partner agreement to apply." }),
});

export const profileSchema = z.object({
  name,
  phone: phone.or(z.literal("")).transform((v) => (v === "" ? null : v)),
  companyName: optionalText(120),
  city: optionalText(80),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ token: z.string().min(20), password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const checkoutSchema = z.object({
  billingName: name,
  billingCompany: optionalText(120),
  billingGstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^$|^[0-9]{2}[A-Z0-9]{13}$/, "GSTIN is 15 characters, e.g. 29ABCDE1234F1Z5.")
    .transform((v) => (v === "" ? null : v)),
  partnerCode: trimmed(20).toUpperCase().optional(),
});

export const leadSchema = z.object({
  businessName: trimmed(120).min(2, "Enter the business name."),
  contactName: trimmed(80).min(2, "Enter a contact name."),
  email: email.or(z.literal("")).transform((v) => (v === "" ? null : v)),
  phone: phone.or(z.literal("")).transform((v) => (v === "" ? null : v)),
  productId: z.string().transform((v) => (v === "" ? null : v)),
  notes: optionalText(1000),
});

export const quoteSchema = z.object({
  productId: z.string().min(1),
  name,
  email,
  phone,
  city: trimmed(80).min(2, "Enter the site city."),
  message: optionalText(1000),
});

export const payoutSettingsSchema = z.object({
  payoutUpi: z
    .string()
    .trim()
    .regex(/^[\w.-]{2,64}@[A-Za-z]{2,32}$/, "Enter a UPI ID like name@bank."),
});

/** Only allow same-site relative redirects after login, to prevent open redirects. */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
