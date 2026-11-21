import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth/guards";
import { getPartnerProfile } from "@/server/services/partner.service";
import { listPartnerCatalog } from "@/server/services/catalog.service";
import { listLicenceKeys, listOrdersForUser } from "@/server/services/order.service";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { BulkOrderForm } from "@/components/partner/bulk-order-form";

export const metadata: Metadata = { title: "Bulk ordering" };

export default async function PartnerOrdersPage() {
  const user = await requireUser(["partner"]);
  const approved = (await getPartnerProfile(user.id))?.status === "approved";
  const catalog = await listPartnerCatalog();
  const orders = await listOrdersForUser(user.id);
  const keys = await listLicenceKeys(user.id);
  const unused = keys.filter((k) => !k.key.redeemedAt);

  return (
    <>
      <PageHeader title="Bulk ordering" description="Order hardware and licence packs at partner prices. Volume tiers apply automatically." />
      {!approved && <Alert tone="info" className="mb-6">Bulk ordering opens once your partner account is approved.</Alert>}

      <Card>
        <CardHeader title="Partner price list" description="Prices exclude GST. Hardware ships to your registered address for installation." />
        <BulkOrderForm
          disabled={!approved}
          items={catalog.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            icon: item.icon,
            retailPrice: item.unitPrice,
            minQuantity: item.minQuantity,
            tiers: item.tiers,
          }))}
        />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Licence keys" description={`${unused.length} unused of ${keys.length}. Give one to each client to activate.`} />
          {unused.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">No unused keys. Licence packs you order appear here.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {unused.map(({ key, productName }) => (
                <li key={key.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="font-mono">{key.key}</span>
                  <span className="text-xs text-ink-muted">{productName}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Your bulk orders" />
          {orders.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">No orders yet.</p>
          ) : (
            <Table>
              <thead><tr><Th>Order</Th><Th>Date</Th><Th>Status</Th><Th className="text-right">Total</Th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <Td><Link href={`/invoices/${order.id}`} className="font-medium text-brand hover:underline">{order.number}</Link></Td>
                    <Td>{formatDate(order.createdAt)}</Td>
                    <Td><StatusBadge status={order.status} /></Td>
                    <Td className="text-right tabular-nums">{formatMoney(order.total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
