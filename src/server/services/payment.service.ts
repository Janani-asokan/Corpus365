import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { orders, users, type Order } from "@/server/db/schema";
import { paymentGateway } from "@/server/payments";
import { PaymentProviderError, type PaymentRequest } from "@/server/payments/gateway";
import { getMailer } from "@/server/mail/mailer";
import { formatMoney } from "@/domain/money";
import { config } from "@/lib/config";
import { UserFacingError } from "@/lib/errors";
import type { CheckoutSession, PendingPayment } from "@/lib/payment-types";
import { markPaidAndFulfil } from "./fulfilment.service";

export interface Payer {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
}

/** Result of starting payment: done already, or waiting for the browser checkout. */
export type PaymentOutcome = { status: "paid"; order: Order } | { status: "pending"; order: Order; payment: PendingPayment };

function requestFor(order: Order, payer: Payer, description: string): PaymentRequest {
  return {
    amount: order.total,
    currency: "INR",
    reference: order.number,
    description,
    customer: { name: payer.name, email: payer.email, phone: payer.phone },
  };
}

function markFailed(orderId: string): void {
  db.update(orders).set({ status: "failed" }).where(eq(orders.id, orderId)).run();
}

function providerFailure(order: Order, error: unknown): never {
  markFailed(order.id);
  if (error instanceof PaymentProviderError) {
    console.error(`[payments] ${order.number}: ${error.message}`);
    throw new UserFacingError("We couldn’t reach the payment provider. Please try again in a moment.");
  }
  throw error;
}

/** Starts an on-session payment for a pending order. */
export async function beginPayment(order: Order, payer: Payer, description: string, now = new Date()): Promise<PaymentOutcome> {
  const gateway = paymentGateway();
  let start;
  try {
    start = await gateway.startCheckout(requestFor(order, payer, description));
  } catch (error) {
    providerFailure(order, error);
  }

  db.update(orders)
    .set({ paymentProvider: gateway.name, providerOrderId: start.providerOrderId })
    .where(eq(orders.id, order.id))
    .run();

  if (start.kind === "paid") {
    const paid = await completeOrderPayment(order.id, start.providerPaymentId, now);
    return { status: "paid", order: paid };
  }
  return { status: "pending", order, payment: { orderId: order.id, session: start.session } };
}

/** Bills an absent customer (renewals) by payment link, or settles instantly in test mode. */
export async function billByLink(order: Order, payer: Payer, description: string, now = new Date()): Promise<"paid" | "link_sent"> {
  const gateway = paymentGateway();
  let start;
  try {
    start = await gateway.createPaymentLink({
      ...requestFor(order, payer, description),
      expiresAt: new Date(now.getTime() + 7 * 86_400_000),
      callbackUrl: `${config.appUrl}/payments/razorpay/return`,
    });
  } catch (error) {
    providerFailure(order, error);
  }

  db.update(orders)
    .set({ paymentProvider: gateway.name, providerOrderId: start.providerOrderId, paymentUrl: start.kind === "link" ? start.url : null })
    .where(eq(orders.id, order.id))
    .run();

  if (start.kind === "paid") {
    await completeOrderPayment(order.id, start.providerPaymentId, now);
    return "paid";
  }
  await getMailer().send({
    to: payer.email,
    subject: `Renew your Corpus365 subscription · ${formatMoney(order.total, 2)}`,
    text: `Hi ${payer.name},\n\n${description} is due. Pay securely here to keep using it:\n${start.url}\n\nThe link also works from your account under Subscriptions.`,
  });
  return "link_sent";
}

/**
 * Marks an order paid and delivers it. Idempotent: the browser confirmation,
 * the payment-link return and webhooks may all report the same payment.
 */
export async function completeOrderPayment(orderId: string, providerPaymentId: string, paidAt = new Date()): Promise<Order> {
  const { order, newlyPaid } = db.transaction((tx) => markPaidAndFulfil(tx, orderId, providerPaymentId, paidAt));
  if (newlyPaid) await sendReceipt(order);
  return order;
}

/** Verifies what the browser checkout returned, then completes the order. */
export async function confirmCheckout(input: {
  orderId: string;
  userId: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): Promise<Order> {
  const order = db.select().from(orders).where(eq(orders.id, input.orderId)).get();
  if (!order || order.userId !== input.userId || order.providerOrderId !== input.providerOrderId) {
    throw new UserFacingError("We couldn’t match this payment to your order. If you were charged, contact support.");
  }
  if (order.status === "paid") return order;

  const valid = paymentGateway().verifyCheckout({
    providerOrderId: input.providerOrderId,
    providerPaymentId: input.providerPaymentId,
    signature: input.signature,
  });
  if (!valid) {
    console.warn(`[payments] invalid checkout signature for ${order.number}`);
    throw new UserFacingError("We couldn’t verify this payment. If you were charged, contact support with your order number.");
  }
  return completeOrderPayment(order.id, input.providerPaymentId);
}

/**
 * A provider-confirmed payment (webhook or payment-link return). The amount is
 * checked against our order so a mismatched payment is never fulfilled.
 */
export async function recordProviderPayment(input: {
  providerOrderId: string;
  providerPaymentId: string;
  amount?: number;
}): Promise<{ handled: boolean; order?: Order; reason?: string }> {
  const order = db.select().from(orders).where(eq(orders.providerOrderId, input.providerOrderId)).get();
  if (!order) return { handled: false, reason: "unknown order" };
  if (input.amount !== undefined && input.amount !== order.total) {
    console.error(`[payments] amount mismatch on ${order.number}: paid ${input.amount}, expected ${order.total}`);
    return { handled: false, order, reason: "amount mismatch" };
  }
  return { handled: true, order: await completeOrderPayment(order.id, input.providerPaymentId) };
}

/** Where the browser goes after a confirmed payment, decided by the server. */
export function nextPathAfterPayment(order: Order): string {
  if (order.kind === "renewal") return "/account/subscriptions?renewed=1";
  if (order.kind === "partner_bulk") return `/invoices/${order.id}?placed=1`;
  return `/checkout/success/${order.id}`;
}

async function sendReceipt(order: Order): Promise<void> {
  const buyer = db.select().from(users).where(eq(users.id, order.userId)).get();
  if (!buyer) return;
  await getMailer().send({
    to: buyer.email,
    subject: `Corpus365 receipt ${order.number}`,
    text: `Hi ${buyer.name},\n\nThanks for your payment of ${formatMoney(order.total, 2)} (incl. GST). Your invoice is at ${config.appUrl}/invoices/${order.id}.`,
  });
}

export type { CheckoutSession };
