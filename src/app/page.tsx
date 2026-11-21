import { ArrowRight, BadgeCheck, Handshake, Package, Store } from "lucide-react";
import { listProducts } from "@/server/services/catalog.service";
import { LinkButton } from "@/components/ui/button";
import { FeatureCard } from "@/components/ui/card";
import { ProductCard } from "@/components/catalog/product-card";
import { TIERS } from "@/domain/tiers";
import { bpsToPercent } from "@/domain/money";

export const dynamic = "force-dynamic";

const STEPS = [
  { title: "Share", text: "A partner shares a personal link or code for an app or device." },
  { title: "Try", text: "The business starts a free trial with sample data." },
  { title: "Subscribe", text: "The partner demos it; the business pays online." },
  { title: "Earn", text: "The partner is paid on the sale and on every renewal." },
];

const PROMISES = [
  "No joining fee or starter kit",
  "Written agreement before selling",
  "Single level: no override on others’ sales",
  "Fixed published prices, honest earnings claims",
];

export default function HomePage() {
  const apps = listProducts({ type: "app" });
  const hardware = listProducts({ type: "hardware" }).slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="bg-ink text-paper">
        <div className="container-page grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow !text-accent">Corpus365 Marketplace</p>
            <h1 className="mt-4 text-4xl leading-[1.05] font-bold sm:text-6xl">
              Business software for every business.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-paper/80">
              Billing, stock, staff and customers in one place — set up in minutes for your kind of business, sold and supported by people near you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/marketplace" variant="accent" size="lg">
                Browse the marketplace <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
              <LinkButton href="/partners" size="lg" className="border border-white/20 bg-white/5 hover:bg-white/10">
                Become a partner
              </LinkButton>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-paper/70">
              <BadgeCheck className="size-4 text-accent" aria-hidden /> Free trials · Digital delivery · Local installation & support
            </p>
          </div>

          <div className="grid gap-3">
            {[
              { Icon: Store, title: "Apps", text: "Fitness Center, School ERP, Corpus360 — each built for one kind of business." },
              { Icon: Package, title: "Hardware", text: "Attendance devices, POS terminals, scanners and printers, installed on site." },
              { Icon: Handshake, title: "Partners", text: "Local people who sell, install and support — and earn on every renewal." },
            ].map(({ Icon, title, text }) => (
              <div key={title} className="flex gap-4 rounded-xl border border-white/10 bg-ink-soft p-5">
                <Icon className="mt-0.5 size-6 shrink-0 text-accent" aria-hidden />
                <div>
                  <h2 className="font-semibold text-white">{title}</h2>
                  <p className="mt-1 text-sm text-paper/70">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two needs */}
      <section className="container-page py-16 sm:py-20">
        <p className="eyebrow">The opportunity</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Two needs, one platform</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <FeatureCard>
            <p className="font-display text-sm font-semibold text-brand">Small businesses</p>
            <h3 className="mt-2 text-xl font-semibold">Need simple, affordable software</h3>
            <p className="mt-2 text-ink-muted">Billing, stock, staff and customers in one place, set up in minutes for their kind of business, with someone local to help.</p>
            <LinkButton href="/marketplace?type=app" variant="secondary" className="mt-5">Explore apps</LinkButton>
          </FeatureCard>
          <FeatureCard>
            <p className="font-display text-sm font-semibold text-brand">People everywhere</p>
            <h3 className="mt-2 text-xl font-semibold">Want flexible, recurring income</h3>
            <p className="mt-2 text-ink-muted">Consultants, accountants, IT shops and freelancers who already advise businesses — and can earn every year a client stays.</p>
            <LinkButton href="/partners" variant="secondary" className="mt-5">See partner earnings</LinkButton>
          </FeatureCard>
        </div>
      </section>

      {/* Apps */}
      <section className="border-y border-line bg-surface/60">
        <div className="container-page py-16 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Inside Corpus365</p>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Our first apps</h2>
            </div>
            <LinkButton href="/marketplace?type=app" variant="ghost">All apps <ArrowRight className="size-4" aria-hidden /></LinkButton>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {apps.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-page py-16 sm:py-20">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">From a partner’s link to recurring income</h2>
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <FeatureCard className="h-full">
                <p className="font-display text-sm font-semibold text-brand">{index + 1}</p>
                <h3 className="mt-1 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-ink-muted">{step.text}</p>
              </FeatureCard>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm text-ink-muted">Businesses pay Corpus365 centrally; partners are paid monthly from there.</p>
      </section>

      {/* Hardware */}
      <section className="border-y border-line bg-surface/60">
        <div className="container-page py-16 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Marketplace · Hardware</p>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Hardware that powers every Corpus365 app</h2>
              <p className="mt-2 max-w-2xl text-ink-muted">Sold with the apps, installed and serviced by Channel Partners.</p>
            </div>
            <LinkButton href="/marketplace?type=hardware" variant="ghost">All hardware <ArrowRight className="size-4" aria-hidden /></LinkButton>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hardware.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </div>
      </section>

      {/* Tiers teaser */}
      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow">Channel partner growth path</p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Earn on every sale, and every renewal</h2>
            <p className="mt-3 text-ink-muted">Grow from Channel Partner to Platinum as your own active clients grow. No fees to join, ever.</p>
            <LinkButton href="/partners" className="mt-6">How partners earn <ArrowRight className="size-4" aria-hidden /></LinkButton>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TIERS.map((tier) => (
              <div key={tier.id} className="rounded-xl border border-line bg-surface p-4">
                <p className="font-display font-semibold">{tier.name.replace(" Channel Partner", "")}</p>
                <p className="text-xs text-ink-muted">{tier.minActiveClients}+ active clients</p>
                <p className="mt-3 text-sm font-semibold text-brand">
                  {bpsToPercent(tier.saleRate)} on sale · {bpsToPercent(tier.renewalRate)} on renewal
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Promise */}
      <section className="bg-brand text-paper">
        <div className="container-page py-16 sm:py-20">
          <p className="eyebrow !text-accent">Our promise</p>
          <p className="mt-4 max-w-3xl font-display text-3xl leading-tight font-semibold sm:text-4xl">
            Partners earn only from software sold and renewed. Never from recruiting.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {PROMISES.map((promise) => (
              <li key={promise} className="border-l-4 border-accent pl-3 text-paper/90">{promise}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
