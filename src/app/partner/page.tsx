import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, IndianRupee, TrendingUp, Users } from "lucide-react";
import { requireUser } from "@/server/auth/guards";
import { getEarningsSummary, getPartnerOverview, getPartnerProfile, listCommissions, referralLink } from "@/server/services/partner.service";
import { listLeads } from "@/server/services/lead.service";
import { listProducts } from "@/server/services/catalog.service";
import { bpsToPercent } from "@/domain/money";
import { LEAD_STATUSES, type CommissionKind } from "@/domain/constants";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge, type Tone } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { TierProgressCard } from "@/components/partner/tier-progress";
import { ReferralLinkBuilder } from "@/components/partner/referral-link-builder";

export const metadata: Metadata = { title: "Partner dashboard" };

const KIND_TONE: Record<CommissionKind, Tone> = { sale: "info", renewal: "success", hardware: "brand", launch_bonus: "warning" };

export default async function PartnerDashboardPage() {
  const user = await requireUser(["partner"]);
  const profile = await getPartnerProfile(user.id);
  if (!profile) notFound();
  const approved = profile.status === "approved";
  const { performance, progress, renewalRate } = await getPartnerOverview(user.id);
  const earnings = await getEarningsSummary(user.id);
  const recent = await listCommissions(user.id, 6);
  const leads = await listLeads(user.id);
  const products = (await listProducts()).filter((p) => p.status !== "coming_soon");

  return (
    <>
      <PageHeader
        eyebrow="Channel Partner Portal"
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description={<>Partner code <Badge tone="brand" className="font-mono">{profile.code}</Badge></>}
        actions={<LinkButton href="/partner/clients" variant="secondary">Add a lead</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active clients" value={performance.activeClients} icon={<Users className="size-4" />} />
        <Stat label="Earned this month" value={formatMoney(earnings.thisMonth)} icon={<TrendingUp className="size-4" />} hint={`${formatMoney(earnings.lifetime)} all time`} />
        <Stat label="Pending clearance" value={formatMoney(earnings.pendingClearance)} icon={<Clock className="size-4" />} hint="Held during the refund window" />
        <Stat label="Ready for next payout" value={formatMoney(earnings.available + earnings.inPayout)} icon={<IndianRupee className="size-4" />} hint={`${formatMoney(earnings.paid)} paid so far`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold">Your referral link</h2>
            {approved ? (
              <>
                <p className="mt-1 mb-4 text-sm text-ink-muted">Businesses who sign up or buy through your link, or enter code <span className="font-mono font-medium text-ink">{profile.code}</span> at checkout, are credited to you.</p>
                <ReferralLinkBuilder baseUrl={referralLink(profile.code)} products={products.map((p) => ({ slug: p.slug, name: p.name }))} />
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Your link activates when your application is approved.</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent earnings" action={<Link href="/partner/earnings" className="text-sm font-medium text-brand hover:underline">View all</Link>} />
            {recent.length === 0 ? (
              <EmptyState icon={<IndianRupee className="size-5" />} title="No earnings yet">Share your link with a business you advise — you earn on the first sale and every renewal.</EmptyState>
            ) : (
              <Table>
                <thead><tr><Th>Date</Th><Th>For</Th><Th>Type</Th><Th className="text-right">Amount</Th></tr></thead>
                <tbody>
                  {recent.map((c) => (
                    <tr key={c.id}>
                      <Td className="whitespace-nowrap">{formatDate(c.createdAt)}</Td>
                      <Td className="min-w-56">{c.description}</Td>
                      <Td><Badge tone={KIND_TONE[c.kind]}>{humanize(c.kind)}{c.rate ? ` · ${bpsToPercent(c.rate)}` : ""}</Badge></Td>
                      <Td className="text-right font-medium tabular-nums">{formatMoney(c.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <TierProgressCard progress={progress} renewalRate={renewalRate} />
          <Card className="p-5">
            <h2 className="font-semibold">Lead pipeline</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {LEAD_STATUSES.map((status) => (
                <li key={status} className="flex items-center justify-between">
                  <StatusBadge status={status} />
                  <span className="font-medium tabular-nums">{leads.filter((l) => l.lead.status === status).length}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
