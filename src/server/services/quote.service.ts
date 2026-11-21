import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { first } from "@/server/db/query";
import { products, quoteRequests } from "@/server/db/schema";
import type { QuoteStatus } from "@/domain/constants";
import { UserFacingError } from "@/lib/errors";
import { findApprovedPartnerByCode } from "./partner.service";
import { isUuid } from "./catalog.service";

export async function createQuoteRequest(input: {
  productId: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  message?: string | null;
  userId: string | null;
  referralCode: string | null;
}): Promise<void> {
  const product = isUuid(input.productId) ? await first(db.select().from(products).where(eq(products.id, input.productId)).limit(1)) : undefined;
  if (!product || product.type !== "hardware") throw new UserFacingError("Quotes are available for hardware only.");
  const partner = input.referralCode ? await findApprovedPartnerByCode(input.referralCode) : null;
  await db.insert(quoteRequests).values({
    productId: product.id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    city: input.city,
    message: input.message ?? null,
    userId: input.userId,
    partnerId: partner?.userId ?? null,
  });
}

export async function listQuoteRequests() {
  return db
    .select({ quote: quoteRequests, productName: products.name })
    .from(quoteRequests)
    .innerJoin(products, eq(products.id, quoteRequests.productId))
    .orderBy(desc(quoteRequests.createdAt));
}

export async function setQuoteStatus(quoteId: string, status: QuoteStatus): Promise<void> {
  if (!isUuid(quoteId)) return;
  await db.update(quoteRequests).set({ status }).where(eq(quoteRequests.id, quoteId));
}
