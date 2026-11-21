import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { leads, products } from "@/server/db/schema";
import type { LeadStatus } from "@/domain/constants";
import { UserFacingError } from "@/lib/errors";

export interface LeadInput {
  businessName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  productId: string | null;
  notes?: string | null;
}

export function listLeads(partnerId: string) {
  return db
    .select({ lead: leads, productName: products.name })
    .from(leads)
    .leftJoin(products, eq(products.id, leads.productId))
    .where(eq(leads.partnerId, partnerId))
    .orderBy(desc(leads.updatedAt))
    .all();
}

export function createLead(partnerId: string, input: LeadInput): void {
  if (!input.email && !input.phone) throw new UserFacingError("Add an email or a phone number so you can follow up.");
  db.insert(leads).values({ ...input, notes: input.notes ?? null, partnerId }).run();
}

/** Scoped by partner so one partner can never touch another's leads. */
export function updateLeadStatus(partnerId: string, leadId: string, status: LeadStatus): void {
  const result = db
    .update(leads)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.partnerId, partnerId)))
    .run();
  if (result.changes === 0) throw new UserFacingError("Lead not found.");
}

export function deleteLead(partnerId: string, leadId: string): void {
  db.delete(leads).where(and(eq(leads.id, leadId), eq(leads.partnerId, partnerId))).run();
}
