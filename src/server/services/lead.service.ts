import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { leads, products } from "@/server/db/schema";
import type { LeadStatus } from "@/domain/constants";
import { UserFacingError } from "@/lib/errors";
import { isUuid } from "./catalog.service";

export interface LeadInput {
  businessName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  productId: string | null;
  notes?: string | null;
}

export async function listLeads(partnerId: string) {
  return db
    .select({ lead: leads, productName: products.name })
    .from(leads)
    .leftJoin(products, eq(products.id, leads.productId))
    .where(eq(leads.partnerId, partnerId))
    .orderBy(desc(leads.updatedAt));
}

export async function createLead(partnerId: string, input: LeadInput): Promise<void> {
  if (!input.email && !input.phone) throw new UserFacingError("Add an email or a phone number so you can follow up.");
  const productId = isUuid(input.productId) ? input.productId : null;
  await db.insert(leads).values({ ...input, productId, notes: input.notes ?? null, partnerId });
}

/** Scoped by partner so one partner can never touch another's leads. */
export async function updateLeadStatus(partnerId: string, leadId: string, status: LeadStatus): Promise<void> {
  if (!isUuid(leadId)) throw new UserFacingError("Lead not found.");
  const updated = await db
    .update(leads)
    .set({ status })
    .where(and(eq(leads.id, leadId), eq(leads.partnerId, partnerId)))
    .returning({ id: leads.id });
  if (updated.length === 0) throw new UserFacingError("Lead not found.");
}

export async function deleteLead(partnerId: string, leadId: string): Promise<void> {
  if (!isUuid(leadId)) return;
  await db.delete(leads).where(and(eq(leads.id, leadId), eq(leads.partnerId, partnerId)));
}
