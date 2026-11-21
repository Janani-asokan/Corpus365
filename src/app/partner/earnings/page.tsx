import type { Metadata } from "next";
import Link from "next/link";
import { IndianRupee } from "lucide-react";
import { requireUser } from "@/server/auth/guards";
import { getEarningsSummary, getPartnerProfile, listCommissions } from "@/server/services/partner.service";
import { listPayouts } from "@/server/services/payout.service";
import { PROGRAM } from "@/domain/program";
import { bpsToPercent } from "@/domain/money";
import { formatDate, formatMoney, formatPeriod, humanize } from "@/lib/format";
import { getTier, type TierId } from "@/domain/tiers";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const user = await requireUser(["partner"]);
  const profile = getPartnerProfile(user.id)!;
  const summary = getEarningsSummary(user.id);
  const commissions = listCommissions(user.id, 200);
  const payouts = listPayouts(user.id);

  return (
    <>
      <PageHeader title="Earnings" description={`Commission is held for ${PROGRAM.clearanceDays} days (the refund window), then paid monthly.`} />
      {!profile.payoutUpi && profile.status === "approved" && (
        <Alert tone="warning" title="Add your payout details" className="mb-6">
          We need a UPI ID to pay you. <Link href="/settings" className="font-medium underline">Add it in settings</Link>.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pending clearance" value={formatMoney(summary.pendingClearance)} />
        <Stat label="Available" value={formatMoney(summary.available)} hint="Included in the next payout run" />
        <Stat label="In payout" value={formatMoney(summary.inPayout)} hint="Being transferred" />
        <Stat label="Paid to date" value={formatMoney(summary.paid)} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Payouts" description={profile.payoutUpi ? `Paid to ${profile.payoutUpi}` : undefined} />
        {payouts.length === 0 ? (
          <EmptyState title="No payouts yet">Your first payout is made in the monthly run after your commission clears.</EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Period</Th><Th>Status</Th><Th>Reference</Th><Th className="text-right">Amount</Th></tr></thead>
            <tbody>
              {payouts.map(({ payout }) => (
                <tr key={payout.id}>
                  <Td>{formatPeriod(payout.period)}</Td>
                  <Td><StatusBadge status={payout.status} /></Td>
                  <Td className="font-mono text-xs">{payout.reference ?? "—"}</Td>
                  <Td className="text-right font-medium tabular-nums">{formatMoney(payout.amount, 2)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Commission history" description="Each line keeps the tier and rate that applied when it was earned." />
        {commissions.length === 0 ? (
          <EmptyState icon={<IndianRupee className="size-5" />} title="No commission yet">Earn on the first sale and on every renewal of clients you bring.</EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Date</Th><Th>Description</Th><Th>Type</Th><Th>Rate</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id}>
                  <Td className="whitespace-nowrap">{formatDate(c.createdAt)}</Td>
                  <Td className="min-w-56">{c.description}</Td>
                  <Td>{humanize(c.kind)}</Td>
                  <Td className="whitespace-nowrap text-ink-muted">
                    {c.rate ? `${bpsToPercent(c.rate)} of ${formatMoney(c.baseAmount)}` : "Fixed"}
                    <span className="block text-xs">{getTier(c.tier as TierId).name.replace(" Channel Partner", "")}</span>
                  </Td>
                  <Td><StatusBadge status={c.status} /></Td>
                  <Td className="text-right font-medium tabular-nums">{formatMoney(c.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
