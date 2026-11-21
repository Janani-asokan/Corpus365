import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { requireUser } from "@/server/auth/guards";
import { listPayouts } from "@/server/services/payout.service";
import { generatePayoutsAction } from "@/server/actions/admin.actions";
import { db } from "@/server/db/client";
import { partnerProfiles } from "@/server/db/schema";
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionForm } from "@/components/ui/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { MarkPaidForm } from "@/components/forms/mark-paid-form";

export const metadata: Metadata = { title: "Payouts" };

export default async function AdminPayoutsPage() {
  await requireUser(["admin"]);
  const payouts = listPayouts();
  const upiOf = (partnerId: string) =>
    db.select({ upi: partnerProfiles.payoutUpi }).from(partnerProfiles).where(eq(partnerProfiles.userId, partnerId)).get()?.upi;

  return (
    <>
      <PageHeader
        title="Partner payouts"
        description="Transfer each pending payout, then record the reference. Partners are emailed automatically."
        actions={<ActionForm action={generatePayoutsAction} label="Generate payouts" variant="secondary" size="md" confirm="Create payouts for all cleared commissions now?" />}
      />
      <Card>
        {payouts.length === 0 ? (
          <EmptyState title="No payouts yet" />
        ) : (
          <Table>
            <thead><tr><Th>Partner</Th><Th>Period</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>Pay to / reference</Th></tr></thead>
            <tbody>
              {payouts.map(({ payout, partnerName, partnerEmail }) => (
                <tr key={payout.id}>
                  <Td><p className="font-medium">{partnerName}</p><p className="text-xs text-ink-muted">{partnerEmail}</p></Td>
                  <Td>{formatPeriod(payout.period)}</Td>
                  <Td className="text-right font-medium tabular-nums">{formatMoney(payout.amount, 2)}</Td>
                  <Td><StatusBadge status={payout.status} /></Td>
                  <Td>
                    {payout.status === "paid" ? (
                      <p className="text-xs"><span className="font-mono">{payout.reference}</span><span className="block text-ink-muted">{formatDate(payout.paidAt)}</span></p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-ink-muted">UPI: <span className="font-mono text-ink">{upiOf(payout.partnerId) ?? "not provided"}</span></p>
                        <MarkPaidForm payoutId={payout.id} />
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
