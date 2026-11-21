import { and, asc, eq, inArray, like, or } from "drizzle-orm";
import { db, type Executor } from "@/server/db/client";
import { partnerPriceTiers, plans, products, type Plan, type Product } from "@/server/db/schema";
import type { ProductStatus, ProductType } from "@/domain/constants";
import { minimumQuantity, type PriceTier } from "@/domain/pricing";

export type ProductWithPlans = Product & { plans: Plan[] };

export interface CatalogFilter {
  type?: ProductType;
  category?: string;
  query?: string;
}

export function listProducts(filter: CatalogFilter = {}): ProductWithPlans[] {
  const conditions = [];
  if (filter.type) conditions.push(eq(products.type, filter.type));
  if (filter.category) conditions.push(eq(products.category, filter.category));
  if (filter.query) {
    const pattern = `%${filter.query.replace(/[%_]/g, "")}%`;
    conditions.push(or(like(products.name, pattern), like(products.tagline, pattern), like(products.category, pattern)));
  }

  const rows = db
    .select()
    .from(products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(products.sortOrder), asc(products.name))
    .all();
  return attachPlans(rows);
}

export function listCategories(): { type: ProductType; category: string }[] {
  return db
    .selectDistinct({ type: products.type, category: products.category })
    .from(products)
    .orderBy(asc(products.type), asc(products.category))
    .all();
}

export function getProductBySlug(slug: string): ProductWithPlans | null {
  const product = db.select().from(products).where(eq(products.slug, slug)).get();
  return product ? attachPlans([product])[0]! : null;
}

export function getProductById(id: string, executor: Executor = db): Product | null {
  return executor.select().from(products).where(eq(products.id, id)).get() ?? null;
}

export function getPlan(planId: string, executor: Executor = db): Plan | null {
  return executor.select().from(plans).where(eq(plans.id, planId)).get() ?? null;
}

function attachPlans(rows: Product[]): ProductWithPlans[] {
  if (rows.length === 0) return [];
  const allPlans = db
    .select()
    .from(plans)
    .where(inArray(plans.productId, rows.map((p) => p.id)))
    .orderBy(asc(plans.price))
    .all();
  return rows.map((product) => ({ ...product, plans: allPlans.filter((p) => p.productId === product.id) }));
}

export type PartnerCatalogItem = Product & { tiers: PriceTier[]; minQuantity: number };

/** Products orderable in bulk at partner prices, with their volume tiers. */
export function listPartnerCatalog(executor: Executor = db): PartnerCatalogItem[] {
  const tiers = executor.select().from(partnerPriceTiers).orderBy(asc(partnerPriceTiers.minQuantity)).all();
  const productIds = [...new Set(tiers.map((t) => t.productId))];
  if (productIds.length === 0) return [];

  return executor
    .select()
    .from(products)
    .where(and(inArray(products.id, productIds), eq(products.status, "live")))
    .orderBy(asc(products.type), asc(products.sortOrder))
    .all()
    .map((product) => {
      const own = tiers
        .filter((t) => t.productId === product.id)
        .map(({ minQuantity, unitPrice }) => ({ minQuantity, unitPrice }));
      return { ...product, tiers: own, minQuantity: minimumQuantity(own) };
    });
}

export function setProductStatus(productId: string, status: ProductStatus): void {
  db.update(products).set({ status }).where(eq(products.id, productId)).run();
}

/** Lowest monthly-equivalent price, for "from ₹X/month" labels. */
export function startingPrice(product: ProductWithPlans): { amount: number; interval: Plan["interval"] } | null {
  if (product.type === "hardware") return product.unitPrice ? { amount: product.unitPrice, interval: "year" } : null;
  const monthly = product.plans.find((p) => p.interval === "month");
  const first = monthly ?? product.plans[0];
  return first ? { amount: first.price, interval: first.interval } : null;
}
