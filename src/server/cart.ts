import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { COOKIE, config } from "@/lib/config";
import { priceRetailLines, type CartLine, type PricedLine } from "./services/order.service";
import { computeTotals, type Totals } from "@/domain/pricing";

const cartSchema = z
  .array(
    z.object({
      productId: z.string().max(64),
      planId: z.string().max(64).nullable(),
      quantity: z.number().int().min(1).max(50),
    }),
  )
  .max(20);

/** The cart cookie holds only ids and quantities; prices always come from the database. */
export async function readCartLines(): Promise<CartLine[]> {
  const raw = (await cookies()).get(COOKIE.cart)?.value;
  if (!raw) return [];
  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export async function writeCartLines(lines: CartLine[]): Promise<void> {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(COOKIE.cart);
    return;
  }
  store.set(COOKIE.cart, JSON.stringify(lines), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export interface Cart {
  lines: PricedLine[];
  totals: Totals;
  count: number;
}

export async function getCart(): Promise<Cart> {
  const lines = await priceRetailLines(await readCartLines());
  return {
    lines,
    totals: computeTotals(lines.map((l) => l.lineTotal)),
    count: lines.reduce((n, l) => n + l.quantity, 0),
  };
}

/** Apps are one subscription per product (replacing the plan); hardware quantities add up. */
export function addLine(lines: CartLine[], next: CartLine, isApp: boolean): CartLine[] {
  if (isApp) return [...lines.filter((l) => l.productId !== next.productId), { ...next, quantity: 1 }];
  const existing = lines.find((l) => l.productId === next.productId);
  if (!existing) return [...lines, next];
  return lines.map((l) => (l === existing ? { ...l, quantity: Math.min(50, l.quantity + next.quantity) } : l));
}
