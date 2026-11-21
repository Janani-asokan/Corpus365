"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { reviewPartner } from "@/server/services/partner.service";
import { setProductStatus } from "@/server/services/catalog.service";
import { processDueRenewals } from "@/server/services/order.service";
import { generatePayouts, markPayoutPaid } from "@/server/services/payout.service";
import { setQuoteStatus } from "@/server/services/quote.service";
import { audit } from "@/server/services/audit.service";
import { db } from "@/server/db/client";
import { PRODUCT_STATUSES, QUOTE_STATUSES } from "@/domain/constants";
import { formatMoney } from "@/domain/money";
import { formToObject, type ActionState } from "@/lib/validation";
import { attempt } from "./helpers";

const requireAdmin = () => requireUser(["admin"]);

const reviewSchema = z.object({
  partnerId: z.string().min(1),
  decision: z.enum(["approved", "rejected", "suspended"]),
  note: z.string().trim().max(500).optional(),
});

export async function reviewPartnerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = reviewSchema.safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const result = await attempt(
    () => reviewPartner({ adminId: admin.id, ...parsed.data, note: parsed.data.note || null }),
    `Partner ${parsed.data.decision}.`,
  );
  revalidatePath("/admin", "layout");
  return result;
}

export async function setProductStatusAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ productId: z.string().min(1), status: z.enum(PRODUCT_STATUSES) })
    .safeParse(formToObject(form));
  if (!parsed.success) return;
  setProductStatus(parsed.data.productId, parsed.data.status);
  audit(db, { actorId: admin.id, action: "product.status", entityId: parsed.data.productId, detail: parsed.data.status });
  revalidatePath("/", "layout");
}

export async function runRenewalsAction(_prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  const result = await processDueRenewals();
  audit(db, { actorId: admin.id, action: "renewals.run", detail: JSON.stringify(result) });
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: `Renewed ${result.renewed}, cancelled ${result.cancelled}, trials ended ${result.trialsEnded}, failed ${result.failed}.`,
  };
}

export async function generatePayoutsAction(_prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  const { created, total } = generatePayouts(admin.id);
  revalidatePath("/admin/payouts");
  if (created === 0) return { ok: true, message: "No cleared commissions to pay out right now." };
  return {
    ok: true,
    message: `Created ${created} payout${created === 1 ? "" : "s"} totalling ${formatMoney(total)}. Mark each as paid once transferred.`,
  };
}

export async function markPayoutPaidAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ payoutId: z.string().min(1), reference: z.string().trim().min(3, "Enter the bank/UPI reference.").max(80) })
    .safeParse(formToObject(form));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };

  const result = await attempt(() => markPayoutPaid(admin.id, parsed.data.payoutId, parsed.data.reference), "Payout marked as paid.");
  revalidatePath("/admin/payouts");
  return result;
}

export async function setQuoteStatusAction(form: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ quoteId: z.string().min(1), status: z.enum(QUOTE_STATUSES) }).safeParse(formToObject(form));
  if (!parsed.success) return;
  setQuoteStatus(parsed.data.quoteId, parsed.data.status);
  revalidatePath("/admin/quotes");
}
