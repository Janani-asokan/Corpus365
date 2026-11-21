import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/server/auth/guards";
import { getCart } from "@/server/cart";
import { readReferralCode } from "@/server/referral";
import { db } from "@/server/db/client";
import { partnerProfiles, users } from "@/server/db/schema";
import { findApprovedPartnerByCode } from "@/server/services/partner.service";
import { getUser } from "@/server/services/user.service";
import { paymentGateway } from "@/server/payments";
import { formatMoney } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { OrderSummary } from "@/components/catalog/order-summary";
import { CheckoutForm } from "@/components/forms/checkout-form";

export const metadata: Metadata = { title: "Checkout" };

function partnerName(userId: string) {
  return db
    .select({ name: users.name, code: partnerProfiles.code })
    .from(partnerProfiles)
    .innerJoin(users, eq(users.id, partnerProfiles.userId))
    .where(eq(partnerProfiles.userId, userId))
    .get();
}

export default async function CheckoutPage() {
  const user = await requireUser(["client"], "/checkout");
  const cart = await getCart();
  if (cart.lines.length === 0) redirect("/cart");

  const account = getUser(user.id);
  let partner: { code: string; name: string; locked: boolean } | null = null;
  if (account?.referredByPartnerId) {
    const p = partnerName(account.referredByPartnerId);
    if (p) partner = { ...p, locked: true };
  } else {
    const code = await readReferralCode();
    const profile = code ? findApprovedPartnerByCode(code) : null;
    const p = profile ? partnerName(profile.userId) : null;
    if (p) partner = { ...p, locked: false };
  }

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-3xl font-semibold">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <Card className="p-6">
          <h2 className="mb-5 text-lg font-semibold">Billing details</h2>
          {paymentGateway().name === "test" && (
            <Alert tone="warning" title="Test payment mode" className="mb-5">
              Payments are simulated and always succeed. Connect a payment provider before going live.
            </Alert>
          )}
          <CheckoutForm
            defaults={{ billingName: user.name, billingCompany: user.companyName }}
            totalLabel={formatMoney(cart.totals.total, 2)}
            partner={partner}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Your order</h2>
          <ul className="mb-4 space-y-3 text-sm">
            {cart.lines.map((line) => (
              <li key={line.product.id} className="flex justify-between gap-3">
                <span>{line.description}{line.quantity > 1 && ` × ${line.quantity}`}</span>
                <span className="tabular-nums">{formatMoney(line.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <OrderSummary totals={cart.totals} fractionDigits={2} />
        </Card>
      </div>
    </div>
  );
}
