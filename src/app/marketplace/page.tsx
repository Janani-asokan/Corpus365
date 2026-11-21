import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { listCategories, listProducts } from "@/server/services/catalog.service";
import { ProductCard } from "@/components/catalog/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { PRODUCT_TYPES, type ProductType } from "@/domain/constants";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Business apps and the hardware that works with them, sold and supported by local partners.",
};

type SearchParams = Promise<{ type?: string; category?: string; q?: string }>;

function hrefWith(params: { type?: string; category?: string; q?: string }) {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const qs = search.toString();
  return qs ? `/marketplace?${qs}` : "/marketplace";
}

export default async function MarketplacePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const type = PRODUCT_TYPES.includes(params.type as ProductType) ? (params.type as ProductType) : undefined;
  const query = params.q?.trim().slice(0, 60) || undefined;
  const categories = listCategories().filter((c) => !type || c.type === type);
  const category = categories.some((c) => c.category === params.category) ? params.category : undefined;
  const products = listProducts({ type, category, query });

  const tabs = [
    { label: "All", value: undefined },
    { label: "Apps", value: "app" },
    { label: "Hardware", value: "hardware" },
  ] as const;

  return (
    <div className="container-page py-10 sm:py-14">
      <p className="eyebrow">Marketplace</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Apps and hardware, listed together</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">Choose an app for your kind of business, add the devices that work with it, and get it installed by a partner near you.</p>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Product type" className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {tabs.map((tab) => {
            const active = type === tab.value;
            return (
              <Link
                key={tab.label}
                href={hrefWith({ type: tab.value, q: query })}
                aria-current={active ? "page" : undefined}
                className={cn("rounded-lg px-4 py-2 text-sm font-medium", active ? "bg-ink text-white" : "text-ink-soft hover:bg-ink/5")}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <form role="search" action="/marketplace" className="flex w-full gap-2 lg:max-w-sm">
          {type && <input type="hidden" name="type" value={type} />}
          <label htmlFor="q" className="sr-only">Search the marketplace</label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input id="q" name="q" type="search" defaultValue={query} placeholder="Search apps and devices" className="pl-9" />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Categories">
        <CategoryChip href={hrefWith({ type, q: query })} active={!category}>All categories</CategoryChip>
        {categories.map((c) => (
          <CategoryChip key={`${c.type}-${c.category}`} href={hrefWith({ type, category: c.category, q: query })} active={category === c.category}>
            {c.category}
          </CategoryChip>
        ))}
      </div>

      <p className="mt-6 text-sm text-ink-muted" aria-live="polite">
        {products.length} {products.length === 1 ? "result" : "results"}
        {query && <> for “{query}”</>}
      </p>

      {products.length === 0 ? (
        <EmptyState icon={<Search className="size-5" />} title="Nothing matches your search" action={<Link className="font-medium text-brand underline" href="/marketplace">Clear filters</Link>}>
          Try a different word, or browse all apps and hardware.
        </EmptyState>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}
    </div>
  );
}

function CategoryChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm",
        active ? "border-brand bg-brand-tint font-medium text-brand" : "border-line bg-surface text-ink-soft hover:border-line-strong",
      )}
    >
      {children}
    </Link>
  );
}
