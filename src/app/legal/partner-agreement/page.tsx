import type { Metadata } from "next";
import { TIERS } from "@/domain/tiers";
import { PROGRAM } from "@/domain/program";
import { bpsToPercent } from "@/domain/money";

export const metadata: Metadata = { title: "Channel Partner agreement" };

/** Plain-language summary. The signed legal agreement is the binding document. */
export default function PartnerAgreementPage() {
  return (
    <article className="container-page max-w-3xl py-12 sm:py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">Channel Partner agreement — summary</h1>
      <p className="mt-3 text-ink-muted">This plain-language summary explains the key terms. Before you sell, we send you the full written agreement to sign; that document governs.</p>

      <div className="mt-8 space-y-8 leading-relaxed text-ink-soft">
        <section>
          <h2 className="text-xl font-semibold text-ink">1. Free to join</h2>
          <p className="mt-2">There is no joining fee, starter kit or minimum purchase. You may leave at any time.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-ink">2. How you earn</h2>
          <p className="mt-2">You earn commission only on Corpus365 software sold and renewed by clients you refer, and a one-time margin on hardware you sell. You never earn from recruiting other partners, and no one earns from your sales but you.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {TIERS.map((tier) => (
              <li key={tier.id}>{tier.name}: {bpsToPercent(tier.saleRate)} on the sale, {bpsToPercent(tier.renewalRate)} on each renewal.</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-ink">3. Payment</h2>
          <p className="mt-2">Clients pay Corpus365 directly. Commission becomes payable after a {PROGRAM.clearanceDays}-day refund window and is paid monthly to your registered UPI or bank account. Commission on refunded orders is reversed.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-ink">4. Honest selling</h2>
          <p className="mt-2">Use the published prices. Do not promise features that don’t exist or make earnings claims to others. Your tier is based on your own active clients and their renewals.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-ink">5. Client data</h2>
          <p className="mt-2">Client information you see in the portal may be used only to support those clients, and must be kept confidential.</p>
        </section>
      </div>
    </article>
  );
}
