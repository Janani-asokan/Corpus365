import type { Metadata } from "next";
import Link from "next/link";
import { Handshake, IndianRupee, Percent, Users } from "lucide-react";
import { requireUser } from "@/server/auth/guards";
import { getAdminMetrics, listRecentAudit } from "@/server/services/admin.service";
import { runRenewalsAction, generatePayoutsAction } from "@/server/actions/admin.actions";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { paymentStatus } from "@/server/payments";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardHeader } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/action-form";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = { title: "Admin" };

/** Month-12 targets from the brief, shown against live figures. */
const TARGETS = { payingClients: 2000, partners: 50, channelCost: 0.3 };

export default async function AdminOverviewPage() {
  await requireUser(["admin"]);
  const m = await getAdminMetrics();
  const audit = await listRecentAudit(12);
  const payments = paymentStatus();

  return (
    <>
      <PageHeader title="Marketplace overview" description="Live figures against the month-12 targets." />
      {!payments.ready ? (
        <Alert tone="danger" title="Payments are switched off" className="mb-6">{payments.problem} Clients cannot check out until this is fixed.</Alert>
      ) : payments.provider === "test" ? (
        <Alert tone="warning" title="Test payments" className="mb-6">Checkout is simulated. Set the Razorpay keys to take real payments.</Alert>
      ) : (
        <Alert tone={payments.keyMode === "live" ? "success" : "info"} title={`Razorpay connected · ${payments.keyMode} mode`} className="mb-6">
          {payments.keyMode === "live" ? "Real payments are being collected." : "Using test keys: no real money moves."}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Paying clients" value={formatCount(m.payingClients)} icon={<Users className="size-4" />} hint={`Target ${formatCount(TARGETS.payingClients)}+ · ${m.trials} on trial`} />
        <Stat label="Approved partners" value={m.partnersApproved} icon={<Handshake className="size-4" />} hint={<>Target {TARGETS.partners} · <Link href="/admin/partners?status=pending" className="font-medium text-brand hover:underline">{m.partnersPending} awaiting review</Link></>} />
        <Stat label="Net sales (excl. GST)" value={formatMoney(m.revenueTotal)} icon={<IndianRupee className="size-4" />} hint={`${formatMoney(m.revenueThisMonth)} this month`} />
        <Stat label="Channel cost of revenue" value={`${(m.channelCostShare * 100).toFixed(1)}%`} icon={<Percent className="size-4" />} hint={`Target under ${TARGETS.channelCost * 100}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Billing cycle</h2>
          <p className="mt-1 mb-4 text-sm text-ink-muted">Ends lapsed trials, honours cancellations and bills due subscriptions (a Razorpay payment link, with a grace period before access lapses). Schedule it daily; run it now to catch up.</p>
          <ActionForm action={runRenewalsAction} label="Process due renewals" variant="primary" pendingLabel="Processing…" />
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Monthly partner payouts</h2>
          <p className="mt-1 mb-4 text-sm text-ink-muted">
            Bundles cleared commission per partner. {formatMoney(m.commissionOwed)} pending · {formatMoney(m.commissionPaid)} paid to date.
          </p>
          <div className="flex flex-wrap items-start gap-3">
            <ActionForm action={generatePayoutsAction} label="Generate payouts" variant="secondary" pendingLabel="Generating…" confirm="Create payouts for all cleared commissions now?" />
            <Link href="/admin/payouts" className="mt-2 text-sm font-medium text-brand hover:underline">Review payouts →</Link>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent activity" description="Audit log of sensitive actions." />
        <Table>
          <thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Detail</Th></tr></thead>
          <tbody>
            {audit.map(({ event, actor }) => (
              <tr key={event.id}>
                <Td className="whitespace-nowrap">{formatDate(event.createdAt)}</Td>
                <Td>{actor ?? "System"}</Td>
                <Td className="font-mono text-xs">{event.action}</Td>
                <Td className="max-w-xs truncate text-ink-muted">{event.detail ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
