import { razorpaySecrets } from "@/server/payments";
import { verifyWebhookSignature } from "@/server/payments/razorpay/signatures";
import { recordProviderPayment } from "@/server/services/payment.service";

export const dynamic = "force-dynamic";

interface RazorpayEvent {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string | null; amount: number; status: string } };
    order?: { entity: { id: string; amount_paid: number } };
    payment_link?: { entity: { id: string; amount_paid: number } };
  };
}

/**
 * Razorpay webhook (Dashboard → Settings → Webhooks). Subscribe to
 * order.paid, payment.captured and payment_link.paid with the same secret as
 * RAZORPAY_WEBHOOK_SECRET. This catches payments where the customer closed the
 * browser before our confirmation ran. Handling is idempotent, so retries and
 * overlapping events are harmless.
 */
export async function POST(request: Request) {
  const { webhookSecret } = razorpaySecrets();
  if (!webhookSecret) return new Response("Webhook not configured", { status: 503 });

  const rawBody = await request.text(); // signature is over the exact raw bytes
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature({ rawBody, signature, webhookSecret })) {
    console.warn("[razorpay webhook] invalid signature");
    return new Response("Invalid signature", { status: 400 });
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const payment = event.payload.payment?.entity;
  try {
    if (event.event === "payment_link.paid" && event.payload.payment_link && payment) {
      await recordProviderPayment({
        providerOrderId: event.payload.payment_link.entity.id,
        providerPaymentId: payment.id,
        amount: event.payload.payment_link.entity.amount_paid,
      });
    } else if ((event.event === "order.paid" || event.event === "payment.captured") && payment?.order_id) {
      await recordProviderPayment({ providerOrderId: payment.order_id, providerPaymentId: payment.id, amount: payment.amount });
    }
  } catch (error) {
    // 5xx makes Razorpay retry later, which is what we want for transient failures.
    console.error(`[razorpay webhook] ${event.event} failed`, error);
    return new Response("Processing failed", { status: 500 });
  }

  // Unknown, irrelevant or duplicate events are acknowledged so Razorpay stops retrying.
  return Response.json({ received: true });
}
