import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  verifyCheckoutSignature,
  verifyPaymentLinkSignature,
  verifyWebhookSignature,
} from "@/server/payments/razorpay/signatures";

const secret = "test_key_secret";
const sign = (payload: string, key = secret) => createHmac("sha256", key).update(payload).digest("hex");

describe("Razorpay signatures", () => {
  it("accepts a valid checkout signature over order_id|payment_id", () => {
    const signature = sign("order_ABC|pay_XYZ");
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature, keySecret: secret })).toBe(true);
  });

  it("rejects a signature for a different payment, order or key", () => {
    const signature = sign("order_ABC|pay_XYZ");
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_OTHER", signature, keySecret: secret })).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_OTHER", paymentId: "pay_XYZ", signature, keySecret: secret })).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature, keySecret: "wrong" })).toBe(false);
  });

  it("rejects malformed signatures without throwing", () => {
    expect(verifyCheckoutSignature({ orderId: "o", paymentId: "p", signature: "", keySecret: secret })).toBe(false);
    expect(verifyCheckoutSignature({ orderId: "o", paymentId: "p", signature: "zz", keySecret: secret })).toBe(false);
  });

  it("verifies payment-link callbacks", () => {
    const signature = sign("plink_1|C365-001001|paid|pay_1");
    const base = { paymentLinkId: "plink_1", referenceId: "C365-001001", paymentId: "pay_1", keySecret: secret };
    expect(verifyPaymentLinkSignature({ ...base, status: "paid", signature })).toBe(true);
    expect(verifyPaymentLinkSignature({ ...base, status: "cancelled", signature })).toBe(false);
  });

  it("verifies webhooks over the exact raw body", () => {
    const body = JSON.stringify({ event: "order.paid", payload: {} });
    const signature = sign(body, "whsec");
    expect(verifyWebhookSignature({ rawBody: body, signature, webhookSecret: "whsec" })).toBe(true);
    expect(verifyWebhookSignature({ rawBody: body + " ", signature, webhookSecret: "whsec" })).toBe(false);
  });
});
