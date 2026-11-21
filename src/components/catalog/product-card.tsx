import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ProductWithPlans } from "@/server/services/catalog.service";
import { startingPrice } from "@/server/services/catalog.service";
import { formatMoney } from "@/lib/format";
import { ProductIcon } from "@/components/ui/product-icon";
import { StatusBadge } from "@/components/ui/badge";

export function PriceLabel({ product }: { product: ProductWithPlans }) {
  if (product.status === "quote_only") return <span className="text-sm font-medium text-ink-soft">Quoted per site</span>;
  const price = startingPrice(product);
  if (!price) return null;
  return (
    <span className="text-sm text-ink-muted">
      {product.type === "app" ? "From " : ""}
      <span className="font-display text-lg font-semibold text-ink">{formatMoney(price.amount)}</span>
      {product.type === "app" ? `/${price.interval}` : " each"}
    </span>
  );
}

export function ProductCard({ product }: { product: ProductWithPlans }) {
  return (
    <Link
      href={`/marketplace/${product.slug}`}
      className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <ProductIcon icon={product.icon} type={product.type} />
        {product.status !== "live" && <StatusBadge status={product.status} />}
      </div>
      <p className="mt-4 text-xs font-medium tracking-wide text-brand uppercase">
        {product.type === "app" ? "App" : "Hardware"} · {product.category}
      </p>
      <h3 className="mt-1 text-lg font-semibold group-hover:text-brand">{product.name}</h3>
      <p className="mt-1 flex-1 text-sm text-ink-muted">{product.tagline}</p>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
        <PriceLabel product={product} />
        <ArrowRight className="size-4 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
      </div>
    </Link>
  );
}
