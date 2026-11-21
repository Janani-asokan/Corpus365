import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { products, quoteRequests } from "@/server/db/schema";
import type { QuoteStatus } from "@/domain/constants";
import { UserFacingError } from "@/lib/errors";
import { findApprovedPartnerByCode } from "./partner.service";

export function createQuoteRequest(input: {
  productId: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  message?: string | null;
  userId: string | null;
  referralCode: string | null;
}): void {
  const product = db.select().from(products).where(eq(products.id, input.productId)).get();
  if (!product || product.type !== "hardware") throw new UserFacingError("Quotes are available for hardware only.");
  const partner = input.referralCode ? findApprovedPartnerByCode(input.referralCode) : null;
  db.insert(quoteRequests)
    .values({
      productId: product.id,
      name: input.name,
      email: input.email,
      phone: input.phone,
      city: input.city,
      message: input.message ?? null,
      userId: input.userId,
      partnerId: partner?.userId ?? null,
    })
    .run();
}

export function listQuoteRequests() {
  return db
    .select({ quote: quoteRequests, productName: products.name })
    .from(quoteRequests)
    .innerJoin(products, eq(products.id, quoteRequests.productId))
    .orderBy(desc(quoteRequests.createdAt))
    .all();
}

export function setQuoteStatus(quoteId: string, status: QuoteStatus): void {
  db.update(quoteRequests).set({ status }).where(eq(quoteRequests.id, quoteId)).run();
}
