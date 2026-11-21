/**
 * Payment types shared by server and browser. Nothing secret lives here: a
 * checkout session carries only the public key id and the provider order id.
 */
export interface CheckoutSession {
  provider: "razorpay";
  keyId: string;
  providerOrderId: string;
  amount: number; // paise
  currency: "INR";
  name: string;
  description: string;
  prefill: { name: string; email: string; contact?: string };
}

/** A started payment the browser must complete in the provider's checkout. */
export interface PendingPayment {
  orderId: string;
  session: CheckoutSession;
}
