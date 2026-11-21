import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { requireUser } from "@/server/auth/guards";
import { getOrder } from "@/server/services/order.service";
import { formatMoney } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Order confirmed" };

export default async function CheckoutSuccessPage({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requireUser();
  const order = await getOrder((await params).orderId, user);
  if (!order) notFound();
  const hasApps = order.items.some((item) => item.planId);

  return (
    <div className="container-page max-w-2xl py-14 sm:py-20">
      <Card className="p-8 text-center">
        <CircleCheck className="mx-auto size-12 text-brand" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">Payment received — thank you!</h1>
        <p className="mt-2 text-ink-muted">
          Order <span className="font-medium text-ink">{order.number}</span> · {formatMoney(order.total, 2)} incl. GST. A receipt is on its way to {user.email}.
        </p>
        {hasApps && <p className="mt-4 text-sm">Your licence keys are active now and listed under Subscriptions.</p>}
        {order.items.some((item) => !item.planId) && (
          <p className="mt-2 text-sm">Your partner will contact you to schedule hardware installation.</p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/account/subscriptions">Go to my subscriptions</LinkButton>
          <LinkButton href={`/invoices/${order.id}`} variant="secondary">View invoice</LinkButton>
        </div>
      </Card>
    </div>
  );
}
