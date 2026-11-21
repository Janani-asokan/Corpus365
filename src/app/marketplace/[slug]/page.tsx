import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, Wrench } from "lucide-react";
import { getProductBySlug } from "@/server/services/catalog.service";
import { getCurrentUser } from "@/server/auth/guards";
import { startTrialAction } from "@/server/actions/shop.actions";
import { yearlySavingPercent } from "@/domain/pricing";
import { formatMoney } from "@/lib/format";
import { ProductIcon } from "@/components/ui/product-icon";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ActionForm } from "@/components/ui/action-form";
import { AppPlanForm, HardwareForm } from "@/components/catalog/add-to-cart-form";
import { QuoteForm } from "@/components/catalog/quote-form";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = getProductBySlug((await params).slug);
  return product ? { title: product.name, description: product.tagline } : { title: "Not found" };
}

export default async function ProductPage({ params }: { params: Params }) {
  const product = getProductBySlug((await params).slug);
  if (!product) notFound();
  const user = await getCurrentUser();

  const monthly = product.plans.find((p) => p.interval === "month");
  const yearly = product.plans.find((p) => p.interval === "year");
  const saving = monthly && yearly ? yearlySavingPercent(monthly.price, yearly.price) : 0;

  return (
    <div className="container-page py-8 sm:py-12">
      <Link href={`/marketplace?type=${product.type}`} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Back to {product.type === "app" ? "apps" : "hardware"}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="flex items-start gap-5">
            <ProductIcon icon={product.icon} type={product.type} size="lg" />
            <div>
              <p className="eyebrow">{product.type === "app" ? "App" : "Hardware"} · {product.category}</p>
              <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{product.name}</h1>
              <div className="mt-2"><StatusBadge status={product.status} label={product.status === "live" ? "Available now" : undefined} /></div>
            </div>
          </div>
          <p className="mt-6 text-lg text-ink-soft">{product.tagline}</p>
          <p className="mt-3 text-ink-muted">{product.description}</p>

          <h2 className="mt-10 text-lg font-semibold">What’s included</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {product.features.map((feature) => (
              <li key={feature} className="flex gap-2 text-ink-soft">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> {feature}
              </li>
            ))}
          </ul>

          <h2 className="mt-10 text-lg font-semibold">{product.type === "app" ? "Works with" : "Works with these apps"}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {product.worksWith.map((item) => (
              <li key={item} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">{item}</li>
            ))}
          </ul>

          <div className="mt-10 flex gap-3 rounded-xl border border-line bg-surface p-5">
            <Wrench className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
            <p className="text-sm text-ink-soft">
              <span className="font-medium text-ink">Set up by someone near you.</span> A Corpus365 Channel Partner can demo, install and support this for your business. Got a partner code? Enter it at checkout.
            </p>
          </div>
        </div>

        <aside>
          <Card className="p-6 lg:sticky lg:top-24">
            {product.status === "coming_soon" && (
              <Alert tone="info" title="Coming soon">
                {product.name} is not available to buy yet. Ask your Corpus365 partner to let you know when it launches.
              </Alert>
            )}

            {product.status === "quote_only" && (
              <>
                <h2 className="text-lg font-semibold">Get a site quote</h2>
                <p className="mt-1 mb-5 text-sm text-ink-muted">This is priced per site after a quick survey by your local partner.</p>
                <QuoteForm productId={product.id} defaults={user ?? undefined} />
              </>
            )}

            {product.status === "live" && product.type === "app" && (
              <div className="space-y-6">
                <AppPlanForm
                  productId={product.id}
                  plans={product.plans.map((plan) => ({
                    id: plan.id,
                    name: plan.name,
                    interval: plan.interval,
                    priceLabel: formatMoney(plan.price),
                    note: plan.interval === "year" && saving > 0 ? `Save ${saving}%` : undefined,
                  }))}
                />
                {product.trialDays && (
                  <div className="border-t border-line pt-5">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="size-4 text-brand" aria-hidden /> Not sure yet? Try it free for {product.trialDays} days.
                    </p>
                    <p className="mt-1 mb-3 text-sm text-ink-muted">Comes with sample data. No payment needed.</p>
                    <ActionForm action={startTrialAction} label="Start free trial" variant="secondary" size="md" pendingLabel="Starting…">
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="slug" value={product.slug} />
                    </ActionForm>
                  </div>
                )}
              </div>
            )}

            {product.status === "live" && product.type === "hardware" && product.unitPrice && (
              <HardwareForm productId={product.id} priceLabel={formatMoney(product.unitPrice)} />
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
