import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { db, type Executor } from "@/server/db/client";
import { first } from "@/server/db/query";
import { partnerPriceTiers, plans, products, type Plan, type Product } from "@/server/db/schema";
import type { ProductStatus, ProductType } from "@/domain/constants";
import { minimumQuantity, type PriceTier } from "@/domain/pricing";

export type ProductWithPlans = Product & { plans: Plan[] };

export interface CatalogFilter {
  type?: ProductType;
  category?: string;
  query?: string;
}

export async function listProducts(filter: CatalogFilter = {}): Promise<ProductWithPlans[]> {
  const conditions = [];
  if (filter.type) conditions.push(eq(products.type, filter.type));
  if (filter.category) conditions.push(eq(products.category, filter.category));
  if (filter.query) {
    const pattern = `%${filter.query.replace(/[%_\\]/g, "")}%`;
    conditions.push(or(ilike(products.name, pattern), ilike(products.tagline, pattern), ilike(products.category, pattern)));
  }

  const rows = await db
    .select()
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(products.sortOrder), asc(products.name));
  return attachPlans(rows);
}

export async function listCategories(): Promise<{ type: ProductType; category: string }[]> {
  return db
    .selectDistinct({ type: products.type, category: products.category })
    .from(products)
    .orderBy(asc(products.type), asc(products.category));
}

export async function getProductBySlug(slug: string): Promise<ProductWithPlans | null> {
  const product = await first(db.select().from(products).where(eq(products.slug, slug)).limit(1));
  return product ? (await attachPlans([product]))[0]! : null;
}

export async function getProductById(id: string, executor: Executor = db): Promise<Product | null> {
  if (!isUuid(id)) return null;
  return (await first(executor.select().from(products).where(eq(products.id, id)).limit(1))) ?? null;
}

export async function getPlan(planId: string, executor: Executor = db): Promise<Plan | null> {
  if (!isUuid(planId)) return null;
  return (await first(executor.select().from(plans).where(eq(plans.id, planId)).limit(1))) ?? null;
}

async function attachPlans(rows: Product[]): Promise<ProductWithPlans[]> {
  if (rows.length === 0) return [];
  const allPlans = await db
    .select()
    .from(plans)
    .where(inArray(plans.productId, rows.map((p) => p.id)))
    .orderBy(asc(plans.price));
  return rows.map((product) => ({ ...product, plans: allPlans.filter((p) => p.productId === product.id) }));
}

export type PartnerCatalogItem = Product & { tiers: PriceTier[]; minQuantity: number };

/** Products orderable in bulk at partner prices, with their volume tiers. */
export async function listPartnerCatalog(executor: Executor = db): Promise<PartnerCatalogItem[]> {
  const tiers = await executor.select().from(partnerPriceTiers).orderBy(asc(partnerPriceTiers.minQuantity));
  const productIds = [...new Set(tiers.map((t) => t.productId))];
  if (productIds.length === 0) return [];

  const rows = await executor
    .select()
    .from(products)
    .where(and(inArray(products.id, productIds), eq(products.status, "live")))
    .orderBy(asc(products.type), asc(products.sortOrder));
  return rows.map((product) => {
    const own = tiers.filter((t) => t.productId === product.id).map(({ minQuantity, unitPrice }) => ({ minQuantity, unitPrice }));
    return { ...product, tiers: own, minQuantity: minimumQuantity(own) };
  });
}

export async function setProductStatus(productId: string, status: ProductStatus): Promise<void> {
  await db.update(products).set({ status }).where(eq(products.id, productId));
}

/** Lowest monthly-equivalent price, for "from ₹X/month" labels. */
export function startingPrice(product: ProductWithPlans): { amount: number; interval: Plan["interval"] } | null {
  if (product.type === "hardware") return product.unitPrice ? { amount: product.unitPrice, interval: "year" } : null;
  const monthly = product.plans.find((p) => p.interval === "month");
  const firstPlan = monthly ?? product.plans[0];
  return firstPlan ? { amount: firstPlan.price, interval: firstPlan.interval } : null;
}

/** Ids from cookies and forms are untrusted; Postgres rejects malformed UUIDs with an error. */
export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}
