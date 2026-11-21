import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth/guards";
import { listAllOrders } from "@/server/services/order.service";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  await requireUser(["admin"]);
  const orders = await listAllOrders();
  return (
    <>
      <PageHeader title="Orders" description="All retail, renewal and partner bulk orders (latest 200)." />
      <Card>
        <Table>
          <thead><tr><Th>Order</Th><Th>Customer</Th><Th>Type</Th><Th>Date</Th><Th>Status</Th><Th className="text-right">Total</Th></tr></thead>
          <tbody>
            {orders.map(({ order, customer, company }) => (
              <tr key={order.id}>
                <Td><Link href={`/invoices/${order.id}`} className="font-medium text-brand hover:underline">{order.number}</Link></Td>
                <Td><p>{company ?? customer}</p>{company && <p className="text-xs text-ink-muted">{customer}</p>}</Td>
                <Td>{humanize(order.kind)}{order.partnerId && <span className="block text-xs text-ink-muted">via partner</span>}</Td>
                <Td className="whitespace-nowrap">{formatDate(order.createdAt)}</Td>
                <Td><StatusBadge status={order.status} /></Td>
                <Td className="text-right tabular-nums">{formatMoney(order.total, 2)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
