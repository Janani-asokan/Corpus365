"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, requireUser } from "@/server/auth/guards";
import { addLine, readCartLines, writeCartLines } from "@/server/cart";
import { readReferralCode } from "@/server/referral";
import { getPlan, getProductById } from "@/server/services/catalog.service";
import * as orders from "@/server/services/order.service";
import { createQuoteRequest } from "@/server/services/quote.service";
import { checkoutSchema, fieldErrorsOf, formToObject, quoteSchema, type ActionState } from "@/lib/validation";
import { attempt } from "./helpers";

const addToCartSchema = z.object({
  productId: z.string().min(1),
  planId: z.string().optional(),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
});

export async function addToCartAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = addToCartSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Choose a plan or quantity first." };

  const product = getProductById(parsed.data.productId);
  if (!product || product.status !== "live") return { ok: false, message: "This product is not available to buy yet." };

  const isApp = product.type === "app";
  const plan = parsed.data.planId ? getPlan(parsed.data.planId) : null;
  if (isApp && plan?.productId !== product.id) return { ok: false, message: "Choose a plan first." };

  const lines = addLine(
    await readCartLines(),
    { productId: product.id, planId: plan?.id ?? null, quantity: parsed.data.quantity },
    isApp,
  );
  await writeCartLines(lines);
  revalidatePath("/", "layout");
  redirect("/cart");
}

export async function updateCartQuantityAction(form: FormData): Promise<void> {
  const productId = String(form.get("productId") ?? "");
  const quantity = Number(form.get("quantity"));
  const lines = await readCartLines();
  const next =
    Number.isInteger(quantity) && quantity >= 1
      ? lines.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(quantity, 50) } : l))
      : lines.filter((l) => l.productId !== productId);
  await writeCartLines(next);
  revalidatePath("/", "layout");
}

export async function removeFromCartAction(form: FormData): Promise<void> {
  const productId = String(form.get("productId") ?? "");
  await writeCartLines((await readCartLines()).filter((l) => l.productId !== productId));
  revalidatePath("/", "layout");
}

export async function checkoutAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["client"], "/checkout");
  const parsed = checkoutSchema.safeParse(formToObject(form));
  if (!parsed.success) return fieldErrorsOf(parsed.error);

  let outcome: orders.PaymentOutcome | undefined;
  const result = await attempt(async () => {
    outcome = await orders.checkout({
      buyer: user,
      lines: await readCartLines(),
      billing: parsed.data,
      partnerCode: parsed.data.partnerCode,
      referralCookie: await readReferralCode(),
    });
  });
  if (!result.ok || !outcome) return result;
  // Razorpay: the browser opens checkout; the cart is cleared once payment is confirmed.
  if (outcome.status === "pending") return { ok: true, payment: outcome.payment };

  await writeCartLines([]);
  revalidatePath("/", "layout");
  redirect(`/checkout/success/${outcome.order.id}`);
}

export async function startTrialAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const productId = String(form.get("productId") ?? "");
  const slug = String(form.get("slug") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/marketplace/${slug}`)}`);
  if (user.role !== "client") {
    return { ok: false, message: "Trials are for business accounts. Sign in with a client account to start one." };
  }

  const result = await attempt(async () =>
    orders.startTrial({ userId: user.id, productId, referralCookie: await readReferralCode() }),
  );
  if (!result.ok) return result;
  revalidatePath("/account");
  redirect("/account/subscriptions?trial=1");
}

export async function requestQuoteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = quoteSchema.safeParse(formToObject(form));
  if (!parsed.success) return fieldErrorsOf(parsed.error);
  const user = await getCurrentUser();

  return attempt(
    async () => createQuoteRequest({ ...parsed.data, userId: user?.id ?? null, referralCode: await readReferralCode() }),
    "Thanks! A local Corpus365 partner will contact you with a site quote within two working days.",
  );
}

const subscriptionIdSchema = z.object({ subscriptionId: z.string().min(1) });

export async function renewSubscriptionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["client"]);
  const parsed = subscriptionIdSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Subscription not found." };

  let outcome: orders.PaymentOutcome | undefined;
  const result = await attempt(async () => {
    outcome = await orders.renewSubscription({ subscriptionId: parsed.data.subscriptionId, userId: user.id });
  });
  if (!result.ok || !outcome) return result;
  if (outcome.status === "pending") return { ok: true, payment: outcome.payment };
  revalidatePath("/account", "layout");
  return { ok: true, message: "Renewed. Your receipt is in Orders & invoices." };
}

export async function setAutoRenewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["client"]);
  const parsed = subscriptionIdSchema.extend({ cancel: z.enum(["true", "false"]) }).safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Subscription not found." };

  const cancel = parsed.data.cancel === "true";
  const result = await attempt(
    () => orders.setCancelAtPeriodEnd(user.id, parsed.data.subscriptionId, cancel),
    cancel ? "Auto-renew turned off. You keep access until the end of the period." : "Auto-renew is back on.",
  );
  revalidatePath("/account", "layout");
  return result;
}

export async function redeemLicenceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser(["client"]);
  const key = String(form.get("key") ?? "").trim();
  if (!/^C365(-[A-Z0-9]{4}){4}$/i.test(key)) {
    return { ok: false, fieldErrors: { key: ["Licence keys look like C365-ABCD-EFGH-JKMN-PQRS."] } };
  }
  const result = await attempt(() => orders.redeemLicenceKey({ userId: user.id, key }), "Licence activated for one year.");
  revalidatePath("/account", "layout");
  return result;
}
