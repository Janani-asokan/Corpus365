"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import * as leads from "@/server/services/lead.service";
import { placePartnerBulkOrder, type PaymentOutcome } from "@/server/services/order.service";
import { LEAD_STATUSES } from "@/domain/constants";
import { fieldErrorsOf, formToObject, leadSchema, type ActionState } from "@/lib/validation";
import { attempt } from "./helpers";

export async function createLeadAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const partner = await requireUser(["partner"]);
  const parsed = leadSchema.safeParse(formToObject(form));
  if (!parsed.success) return fieldErrorsOf(parsed.error);

  const result = await attempt(() => leads.createLead(partner.id, parsed.data), "Lead added.");
  revalidatePath("/partner/clients");
  return result;
}

const leadStatusSchema = z.object({ leadId: z.string().min(1), status: z.enum(LEAD_STATUSES) });

export async function updateLeadStatusAction(form: FormData): Promise<void> {
  const partner = await requireUser(["partner"]);
  const parsed = leadStatusSchema.safeParse(formToObject(form));
  if (!parsed.success) return;
  leads.updateLeadStatus(partner.id, parsed.data.leadId, parsed.data.status);
  revalidatePath("/partner/clients");
}

export async function deleteLeadAction(form: FormData): Promise<void> {
  const partner = await requireUser(["partner"]);
  leads.deleteLead(partner.id, String(form.get("leadId") ?? ""));
  revalidatePath("/partner/clients");
}

export async function placeBulkOrderAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const partner = await requireUser(["partner"]);
  const lines = [...form.entries()]
    .filter(([key]) => key.startsWith("qty:"))
    .map(([key, value]) => ({ productId: key.slice(4), quantity: Number(value) || 0 }))
    .filter((line) => line.quantity > 0);

  let outcome: PaymentOutcome | undefined;
  const result = await attempt(async () => {
    outcome = await placePartnerBulkOrder({ partner, lines });
  });
  if (!result.ok || !outcome) return result;
  if (outcome.status === "pending") return { ok: true, payment: outcome.payment };
  revalidatePath("/partner", "layout");
  redirect(`/invoices/${outcome.order.id}?placed=1`);
}
