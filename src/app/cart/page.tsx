import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart, Trash2 } from "lucide-react";
import { getCart } from "@/server/cart";
import { removeFromCartAction, updateCartQuantityAction } from "@/server/actions/shop.actions";
import { formatMoney } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { LinkButton, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductIcon } from "@/components/ui/product-icon";
import { Input } from "@/components/ui/field";
import { OrderSummary } from "@/components/catalog/order-summary";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const cart = await getCart();

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-3xl font-semibold">Your cart</h1>

      {cart.lines.length === 0 ? (
        <Card className="mt-6">
          <EmptyState icon={<ShoppingCart className="size-5" />} title="Your cart is empty" action={<LinkButton href="/marketplace">Browse the marketplace</LinkButton>}>
            Add an app subscription or the hardware that goes with it.
          </EmptyState>
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
          <Card>
            <ul className="divide-y divide-line">
              {cart.lines.map((line) => (
                <li key={line.product.id} className="flex flex-wrap items-center gap-4 p-5">
                  <ProductIcon icon={line.product.icon} type={line.product.type} size="sm" />
                  <div className="min-w-40 flex-1">
                    <Link href={`/marketplace/${line.product.slug}`} className="font-medium hover:text-brand">{line.product.name}</Link>
                    <p className="text-sm text-ink-muted">
                      {line.plan ? `${line.plan.name} subscription` : `${formatMoney(line.unitPrice)} each`}
                    </p>
                  </div>

                  {line.product.type === "hardware" ? (
                    <form action={updateCartQuantityAction} className="flex items-center gap-2">
                      <input type="hidden" name="productId" value={line.product.id} />
                      <label htmlFor={`qty-${line.product.id}`} className="sr-only">Quantity for {line.product.name}</label>
                      <Input id={`qty-${line.product.id}`} name="quantity" type="number" min={1} max={50} defaultValue={line.quantity} className="h-9 w-20" />
                      <button type="submit" className={buttonStyles({ variant: "ghost", size: "sm" })}>Update</button>
                    </form>
                  ) : (
                    <span className="text-sm text-ink-muted">1 business</span>
                  )}

                  <p className="w-24 text-right font-medium tabular-nums">{formatMoney(line.lineTotal)}</p>
                  <form action={removeFromCartAction}>
                    <input type="hidden" name="productId" value={line.product.id} />
                    <button type="submit" className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-danger-tint hover:text-danger" aria-label={`Remove ${line.product.name}`}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Order summary</h2>
            <OrderSummary totals={cart.totals} />
            <LinkButton href="/checkout" size="lg" className="mt-5 w-full">Continue to checkout</LinkButton>
            <LinkButton href="/marketplace" variant="ghost" className="mt-2 w-full">Keep shopping</LinkButton>
          </Card>
        </div>
      )}
    </div>
  );
}
