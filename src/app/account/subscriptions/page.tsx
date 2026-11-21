import type { Metadata } from "next";
import { KeyRound, RefreshCw } from "lucide-react";
import { requireUser } from "@/server/auth/guards";
import { listSubscriptionsForUser, pendingRenewalOrder } from "@/server/services/order.service";
import { renewSubscriptionAction, setAutoRenewAction } from "@/server/actions/shop.actions";
import { daysUntil, formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { ProductIcon } from "@/components/ui/product-icon";
import { LinkButton, buttonStyles } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { RedeemLicenceForm } from "@/components/forms/redeem-licence-form";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ trial?: string; renewed?: string; payment?: string }> }) {
  const user = await requireUser(["client"]);
  const { trial, renewed, payment } = await searchParams;
  const subs = await listSubscriptionsForUser(user.id);
  const dueBills = new Map(
    await Promise.all(
      subs.filter((s) => s.subscription.status === "active").map(async (s) => [s.subscription.id, await pendingRenewalOrder(s.subscription.id)] as const),
    ),
  );

  return (
    <>
      <PageHeader title="Subscriptions" description="Your apps, licence keys and renewal settings." />
      {renewed && <Alert tone="success" title="Payment received" className="mb-6">Your subscription is renewed. The invoice is in Orders &amp; invoices.</Alert>}
      {payment === "failed" && <Alert tone="danger" title="We couldn’t confirm that payment" className="mb-6">If money left your account, it will be matched automatically within a few minutes, or refunded by Razorpay. Otherwise, please try again.</Alert>}
      {trial && <Alert tone="success" title="Your free trial has started" className="mb-6">Sign in to the app with your licence key below. Sample data is loaded so you can explore straight away.</Alert>}

      {subs.length === 0 ? (
        <Card>
          <EmptyState icon={<RefreshCw className="size-5" />} title="No subscriptions yet" action={<LinkButton href="/marketplace?type=app">Browse apps</LinkButton>}>
            Start a free trial or subscribe to an app to see it here.
          </EmptyState>
        </Card>
      ) : (
        <ul className="space-y-4">
          {subs.map(({ subscription, product, plan }) => {
            const days = daysUntil(subscription.currentPeriodEnd);
            const due = dueBills.get(subscription.id) ?? null;
            return (
              <li key={subscription.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <ProductIcon icon={product.icon} type={product.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{product.name}</h2>
                        <StatusBadge status={subscription.status} />
                        {subscription.cancelAtPeriodEnd && subscription.status === "active" && <StatusBadge status="cancelled" label="Auto-renew off" />}
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">
                        {plan ? `${plan.name} · ${formatMoney(plan.price)}/${plan.interval} + GST` : `${product.trialDays}-day free trial`}
                      </p>
                      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-ink-muted">{subscription.status === "trialing" ? "Trial ends" : subscription.status === "active" ? (subscription.cancelAtPeriodEnd ? "Access until" : "Renews on") : "Ended"}</dt>
                          <dd className="font-medium">{formatDate(subscription.currentPeriodEnd)}{subscription.status !== "expired" && subscription.status !== "cancelled" && days >= 0 && <span className="font-normal text-ink-muted"> · {days} days</span>}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-ink-muted">Licence key</dt>
                          <dd className="flex flex-wrap items-center gap-2 font-mono font-medium">
                            {subscription.licenseKey}
                            <CopyButton value={subscription.licenseKey} />
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {due?.paymentUrl && (
                    <Alert tone="warning" title={`Renewal payment due · ${formatMoney(due.total, 2)}`} className="mt-4">
                      Pay to keep using {product.name} without interruption.{" "}
                      <a href={due.paymentUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles({ size: "sm", className: "mt-2 sm:mt-0 sm:ml-2" })}>Pay now</a>
                    </Alert>
                  )}
                  <div className="mt-5 flex flex-wrap items-start gap-3 border-t border-line pt-4">
                    {subscription.status === "trialing" && (
                      <LinkButton href={`/marketplace/${product.slug}`} size="sm">Choose a plan to keep using it</LinkButton>
                    )}
                    {plan && !due?.paymentUrl && (subscription.status === "active" || subscription.status === "expired" || subscription.status === "cancelled") && (
                      <ActionForm
                        action={renewSubscriptionAction}
                        label={subscription.status === "active" ? `Renew now · ${formatMoney(plan.price)}` : `Reactivate · ${formatMoney(plan.price)}`}
                        variant={subscription.status === "active" ? "secondary" : "primary"}
                        pendingLabel="Processing…"
                        confirm={`Pay ${formatMoney(plan.price)} + GST to extend ${product.name} by one ${plan.interval}?`}
                      >
                        <input type="hidden" name="subscriptionId" value={subscription.id} />
                      </ActionForm>
                    )}
                    {subscription.status === "active" && (
                      <ActionForm
                        action={setAutoRenewAction}
                        label={subscription.cancelAtPeriodEnd ? "Turn auto-renew on" : "Turn off auto-renew"}
                        variant="ghost"
                        confirm={subscription.cancelAtPeriodEnd ? undefined : "Your access continues until the end of this period, then stops. Continue?"}
                      >
                        <input type="hidden" name="subscriptionId" value={subscription.id} />
                        <input type="hidden" name="cancel" value={subscription.cancelAtPeriodEnd ? "false" : "true"} />
                      </ActionForm>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Card className="mt-6 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="size-4 text-brand" aria-hidden />Have a licence key?</h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">Activate a one-year licence bought for you by your partner.</p>
        <RedeemLicenceForm />
      </Card>
    </>
  );
}
