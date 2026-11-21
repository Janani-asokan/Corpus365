import type { Metadata } from "next";
import { ArrowRight, Gift, Headset, Plane, Trophy } from "lucide-react";
import { TIERS } from "@/domain/tiers";
import { PROGRAM } from "@/domain/program";
import { bpsToPercent, formatMoney } from "@/domain/money";
import { LinkButton } from "@/components/ui/button";
import { FeatureCard } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { EarningsCalculator } from "@/components/catalog/earnings-calculator";

export const metadata: Metadata = {
  title: "Become a Channel Partner",
  description: "Sell, install and support Corpus365 business software near you. Earn on every sale and every renewal. Free to join.",
};

const REWARDS = [
  { Icon: Gift, label: "Fast start", title: "Launch bonus", text: `An extra ${formatMoney(PROGRAM.launchBonus.amount)} on each of your first ${PROGRAM.launchBonus.maxSales} sales within ${PROGRAM.launchBonus.windowDays} days.` },
  { Icon: Plane, label: "Travel", title: "Annual partner trip", text: "An international trip for top partners by own sales and renewals." },
  { Icon: Trophy, label: "Bonuses", title: "Quarterly pool", text: "Shared by Gold and Platinum partners on their own renewals." },
  { Icon: Headset, label: "Support", title: "Tools to sell", text: "Demo accounts, brochures, a helpline and monthly training." },
];

const WAVES = [
  { wave: "Wave 1", title: "Kerala & Bengaluru", text: "EduConnect agents, our service centres, our expert network, accountants." },
  { wave: "Wave 2", title: "Across India", text: "Accountants, IT shops, freelancers and students in metros." },
  { wave: "Wave 3", title: "GCC", text: "UAE, Saudi Arabia, Qatar, Oman: Indian-run businesses and IT resellers." },
  { wave: "Wave 4", title: "UK, US & beyond", text: "Bookkeepers, small-business consultants, diaspora networks." },
];

export default function PartnersPage() {
  return (
    <>
      <section className="bg-ink text-paper">
        <div className="container-page py-16 sm:py-24">
          <p className="eyebrow !text-accent">Join us</p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-[1.05] font-bold sm:text-6xl">Become a Corpus365 Channel Partner</h1>
          <p className="mt-5 max-w-2xl text-lg text-paper/80">
            Help local businesses get set up with software that fits them, and earn on the sale and on every renewal. We are selecting 10–20 partners for the pilot in Kerala and Bengaluru.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/partners/apply" variant="accent" size="lg">Apply free <ArrowRight className="size-4" aria-hidden /></LinkButton>
            <LinkButton href="/login" size="lg" className="border border-white/20 bg-white/5 hover:bg-white/10">Partner sign in</LinkButton>
          </div>
          <ol className="mt-12 grid gap-4 sm:grid-cols-3">
            {[["Apply", "Free sign-up, no fees"], ["Train", "Short course and demo account"], ["Earn", "On sales and every renewal"]].map(([title, text]) => (
              <li key={title} className="border-t-4 border-accent bg-ink-soft p-5">
                <p className="font-semibold text-white">{title}</p>
                <p className="mt-1 text-paper/80">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <p className="eyebrow">Channel partner growth path</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Grow from Channel Partner to Platinum</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier, index) => (
            <div key={tier.id} className="flex flex-col border-b-4 border-brand bg-surface p-5">
              <div className="flex gap-1 text-accent" aria-hidden>{"★".repeat(index + 1)}</div>
              <h3 className="mt-2 text-lg font-semibold">{tier.name}</h3>
              <p className="text-sm text-ink-muted">
                {index === TIERS.length - 1 ? `${tier.minActiveClients}+` : `${tier.minActiveClients}–${TIERS[index + 1]!.minActiveClients - 1}`} active clients
                {tier.minRenewalRate && ` · ${bpsToPercent(tier.minRenewalRate)}+ renewing`}
              </p>
              <p className="mt-3 font-semibold text-brand">{bpsToPercent(tier.saleRate)} on sale · {bpsToPercent(tier.renewalRate)} on renewal</p>
              <p className="mt-2 text-sm text-ink-soft">{tier.perks.join(", ")}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-line bg-surface">
          <Table>
            <caption className="sr-only">Commission rates by tier</caption>
            <thead><tr><Th>Tier</Th><Th>Own active clients</Th><Th>On the sale</Th><Th>On each renewal</Th></tr></thead>
            <tbody>
              {TIERS.map((tier, index) => (
                <tr key={tier.id}>
                  <Td className="font-medium text-brand">{tier.name}</Td>
                  <Td>
                    {index === TIERS.length - 1 ? `${tier.minActiveClients}+` : `${tier.minActiveClients}–${TIERS[index + 1]!.minActiveClients - 1}`}
                    {tier.minRenewalRate && ` · ${bpsToPercent(tier.minRenewalRate)}+ renewing`}
                  </Td>
                  <Td>{bpsToPercent(tier.saleRate)}</Td>
                  <Td>{bpsToPercent(tier.renewalRate)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <p className="mt-3 text-sm text-ink-muted">App subscriptions. Hardware earns a one-time 8–12% margin plus installation fees. Rates are proposed and confirmed in your written agreement.</p>
      </section>

      <section className="container-page pb-16 sm:pb-20">
        <p className="eyebrow">Worked example</p>
        <h2 className="mt-2 mb-8 text-3xl font-semibold sm:text-4xl">See what your own sales could earn</h2>
        <EarningsCalculator />
      </section>

      <section className="border-y border-line bg-surface/60">
        <div className="container-page py-16 sm:py-20">
          <p className="eyebrow">Why partners stay</p>
          <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Rewards that grow with real sales</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {REWARDS.map(({ Icon, label, title, text }) => (
              <FeatureCard key={title}>
                <Icon className="size-6 text-brand" aria-hidden />
                <p className="mt-3 font-display text-sm font-semibold text-brand">{label}</p>
                <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-ink-muted">{text}</p>
              </FeatureCard>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand text-paper">
        <div className="container-page py-16 sm:py-20">
          <p className="eyebrow !text-accent">Our promise</p>
          <p className="mt-4 max-w-3xl font-display text-3xl leading-tight font-semibold sm:text-4xl">Partners earn only from software sold and renewed. Never from recruiting.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {["No joining fee or starter kit", "Written agreement before selling", "Single level: no override on others’ sales", "Fixed published prices, honest earnings claims"].map((p) => (
              <li key={p} className="border-l-4 border-accent pl-3 text-paper/90">{p}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <p className="eyebrow">Go-to-market</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Start close to home, then go global</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WAVES.map((w) => (
            <FeatureCard key={w.wave}>
              <p className="font-display text-sm font-semibold text-brand">{w.wave}</p>
              <h3 className="mt-1 text-lg font-semibold">{w.title}</h3>
              <p className="mt-2 text-ink-muted">{w.text}</p>
            </FeatureCard>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <div>
            <h2 className="text-2xl font-semibold">Ready to start?</h2>
            <p className="mt-1 text-ink-muted">Applying is free and takes two minutes.</p>
          </div>
          <LinkButton href="/partners/apply" size="lg">Apply to become a partner <ArrowRight className="size-4" aria-hidden /></LinkButton>
        </div>
      </section>
    </>
  );
}
