import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireUser } from "@/server/auth/guards";
import { listOrdersForUser } from "@/server/services/order.service";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Orders & invoices" };

export default async function OrdersPage() {
  const user = await requireUser(["client"]);
  const orders = listOrdersForUser(user.id);

  return (
    <>
      <PageHeader title="Orders & invoices" description="Every payment, with a GST invoice you can print or save as PDF." />
      <Card>
        {orders.length === 0 ? (
          <EmptyState icon={<Receipt className="size-5" />} title="No orders yet">Your invoices will appear here after your first purchase.</EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Order</Th><Th>Date</Th><Th>Type</Th><Th>Status</Th><Th className="text-right">Total</Th><Th><span className="sr-only">Invoice</span></Th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <Td className="font-medium">{order.number}</Td>
                  <Td>{formatDate(order.createdAt)}</Td>
                  <Td>{humanize(order.kind)}</Td>
                  <Td><StatusBadge status={order.status} /></Td>
                  <Td className="text-right tabular-nums">{formatMoney(order.total, 2)}</Td>
                  <Td className="text-right"><Link href={`/invoices/${order.id}`} className="font-medium text-brand hover:underline">Invoice</Link></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
