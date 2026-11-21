import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay signature checks (HMAC-SHA256, hex). Pure functions so they can be
 * unit-tested without the network. Comparisons are constant-time.
 * https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/#verify-payment-signature
 */
function hmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checkout handler response: signature over "order_id|payment_id" with the key secret. */
export function verifyCheckoutSignature(input: { orderId: string; paymentId: string; signature: string; keySecret: string }): boolean {
  return safeEqual(hmac(input.keySecret, `${input.orderId}|${input.paymentId}`), input.signature);
}

/** Payment-link callback: signature over "link_id|reference_id|status|payment_id". */
export function verifyPaymentLinkSignature(input: {
  paymentLinkId: string;
  referenceId: string;
  status: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const payload = `${input.paymentLinkId}|${input.referenceId}|${input.status}|${input.paymentId}`;
  return safeEqual(hmac(input.keySecret, payload), input.signature);
}

/** Webhooks: signature over the raw request body with the webhook secret. */
export function verifyWebhookSignature(input: { rawBody: string; signature: string; webhookSecret: string }): boolean {
  return safeEqual(hmac(input.webhookSecret, input.rawBody), input.signature);
}

/** Exposed for tests and the local Razorpay stand-in. */
export function signForTesting(secret: string, payload: string): string {
  return hmac(secret, payload);
}
