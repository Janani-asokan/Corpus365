import type { Metadata } from "next";
import Link from "next/link";
import { Clock, KeyRound, Mail, Phone, RefreshCw, Store } from "lucide-react";
import { eq } from "drizzle-orm";
import { requireUser } from "@/server/auth/guards";
import { listSubscriptionsForUser } from "@/server/services/order.service";
import { getUser } from "@/server/services/user.service";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { daysUntil, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { ProductIcon } from "@/components/ui/product-icon";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RedeemLicenceForm } from "@/components/forms/redeem-licence-form";

export const metadata: Metadata = { title: "My account" };

export default async function AccountOverviewPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser(["client"]);
  const { welcome } = await searchParams;
  const subs = listSubscriptionsForUser(user.id);
  const active = subs.filter((s) => s.subscription.status === "active");
  const trials = subs.filter((s) => s.subscription.status === "trialing");
  const nextRenewal = active.map((s) => s.subscription.currentPeriodEnd).sort((a, b) => a.getTime() - b.getTime())[0];

  const account = getUser(user.id);
  const partner = account?.referredByPartnerId
    ? db.select({ name: users.name, email: users.email, phone: users.phone, city: users.city }).from(users).where(eq(users.id, account.referredByPartnerId)).get()
    : null;

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} description={user.companyName ?? undefined} actions={<LinkButton href="/marketplace"><Store className="size-4" aria-hidden />Browse apps</LinkButton>} />
      {welcome && (
        <Alert tone="success" title="Your account is ready" className="mb-6">
          Start a free trial from the marketplace, or activate a licence key from your partner below.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active subscriptions" value={active.length} icon={<RefreshCw className="size-4" />} />
        <Stat label="Free trials" value={trials.length} icon={<Clock className="size-4" />} hint={trials[0] ? `${Math.max(0, daysUntil(trials[0].subscription.currentPeriodEnd))} days left` : undefined} />
        <Stat label="Next renewal" value={nextRenewal ? formatDate(nextRenewal) : "—"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader title="Your apps" action={<Link href="/account/subscriptions" className="text-sm font-medium text-brand hover:underline">Manage</Link>} />
          {subs.length === 0 ? (
            <EmptyState icon={<Store className="size-5" />} title="No apps yet" action={<LinkButton href="/marketplace?type=app">Find an app</LinkButton>}>
              Try any live app free for 14 days with sample data.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {subs.slice(0, 5).map(({ subscription, product, plan }) => (
                <li key={subscription.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <ProductIcon icon={product.icon} type={product.type} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-ink-muted">
                      {subscription.status === "trialing" ? "Trial ends" : subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} {formatDate(subscription.currentPeriodEnd)}
                      {plan && ` · ${plan.name}`}
                    </p>
                  </div>
                  <StatusBadge status={subscription.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold">Your local partner</h2>
            {partner ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-medium">{partner.name}{partner.city && <span className="font-normal text-ink-muted"> · {partner.city}</span>}</p>
                <p className="flex items-center gap-2 text-ink-soft"><Mail className="size-4 text-brand" aria-hidden /><a href={`mailto:${partner.email}`} className="hover:underline">{partner.email}</a></p>
                {partner.phone && <p className="flex items-center gap-2 text-ink-soft"><Phone className="size-4 text-brand" aria-hidden /><a href={`tel:${partner.phone}`} className="hover:underline">{partner.phone}</a></p>}
                <p className="pt-1 text-ink-muted">Contact them for set-up, training or hardware installation.</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">You don’t have a partner yet. Enter a partner code at checkout to get local set-up and support.</p>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="size-4 text-brand" aria-hidden />Have a licence key?</h2>
            <p className="mt-1 mb-4 text-sm text-ink-muted">Activate a key your partner gave you.</p>
            <RedeemLicenceForm />
          </Card>
        </div>
      </div>
    </>
  );
}
