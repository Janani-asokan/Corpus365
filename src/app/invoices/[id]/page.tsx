import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser, HOME_FOR_ROLE } from "@/server/auth/guards";
import { getOrder, listLicenceKeys } from "@/server/services/order.service";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { LinkButton } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { Alert } from "@/components/ui/alert";
import { OrderSummary } from "@/components/catalog/order-summary";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string; paid?: string }> }) {
  const user = await requireUser();
  const order = await getOrder((await params).id, user);
  if (!order) notFound();
  const query = await searchParams;
  const placed = query.placed === "1";

  const keys = order.kind === "partner_bulk" ? (await listLicenceKeys(order.userId)).filter((k) => order.items.some((i) => i.id === k.key.orderItemId)) : [];

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <LinkButton href={user.role === "client" ? "/account/orders" : HOME_FOR_ROLE[user.role]} variant="ghost">← Back</LinkButton>
        <PrintButton />
      </div>
      {query.paid === "1" && <Alert tone="success" title="Payment received — thank you" className="no-print mb-6">Your subscription is renewed.</Alert>}
      {order.status === "pending" && order.paymentUrl && (
        <Alert tone="warning" title="Awaiting payment" className="no-print mb-6">
          <a href={order.paymentUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">Pay securely with Razorpay</a>
        </Alert>
      )}
      {placed && <Alert tone="success" title="Bulk order placed" className="no-print mb-6">Your order is paid. Hardware ships to your registered address; licence keys are below.</Alert>}

      <Card className="p-6 sm:p-10">
        <div className="flex flex-wrap justify-between gap-6">
          <div>
            <p className="font-display text-xl font-bold">Corpus<span className="text-accent">365</span></p>
            <p className="mt-1 text-sm text-ink-muted">Corpus365 Marketplace<br />Kochi, Kerala, India</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-semibold">{order.status === "paid" ? "Tax invoice" : "Proforma invoice"}</h1>
            <p className="mt-1 text-sm text-ink-muted">{order.number}</p>
            <div className="mt-2"><StatusBadge status={order.status} /></div>
          </div>
        </div>

        <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-ink-muted">Billed to</dt><dd className="font-medium">{order.billingName}{order.billingCompany && <><br />{order.billingCompany}</>}</dd></div>
          <div><dt className="text-ink-muted">GSTIN</dt><dd className="font-medium">{order.billingGstin ?? "—"}</dd></div>
          <div><dt className="text-ink-muted">Date</dt><dd className="font-medium">{formatDate(order.paidAt ?? order.createdAt)} · {humanize(order.kind)}</dd></div>
        </dl>

        <div className="mt-8">
          <Table>
            <thead><tr><Th>Item</Th><Th className="text-right">Qty</Th><Th className="text-right">Unit price</Th><Th className="text-right">Amount</Th></tr></thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <Td>{item.description}</Td>
                  <Td className="text-right tabular-nums">{item.quantity}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(item.unitPrice, 2)}</Td>
                  <Td className="text-right tabular-nums">{formatMoney(item.lineTotal, 2)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div className="mt-6 ml-auto max-w-xs">
          <OrderSummary totals={order} fractionDigits={2} />
        </div>
        {order.paymentReference && <p className="mt-8 text-xs text-ink-muted">Payment reference: {order.paymentReference}</p>}
      </Card>

      {keys.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-semibold">Licence keys</h2>
          <p className="mt-1 text-sm text-ink-muted">Give one key per client. They activate it under Subscriptions → “Have a licence key?”.</p>
          <ul className="mt-4 grid gap-2 font-mono text-sm sm:grid-cols-2">
            {keys.map(({ key }) => (
              <li key={key.id} className="flex justify-between rounded-lg border border-line px-3 py-2">
                {key.key} {key.redeemedAt && <span className="font-sans text-xs text-ink-muted">used</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
