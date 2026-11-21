import type { Minor } from "@/domain/money";
import type { CheckoutSession } from "@/lib/payment-types";

export interface PaymentRequest {
  amount: Minor;
  currency: "INR";
  /** Our order number: the provider's receipt / reference, and idempotency key. */
  reference: string;
  description: string;
  customer: { name: string; email: string; phone?: string | null };
}

/** Starting an on-session payment: either settled immediately, or handed to the browser. */
export type CheckoutStart =
  | { kind: "paid"; providerOrderId: string; providerPaymentId: string }
  | { kind: "checkout"; providerOrderId: string; session: CheckoutSession };

/** Billing a customer who is not present (renewals): settled now, or a link to pay. */
export type LinkStart =
  | { kind: "paid"; providerOrderId: string; providerPaymentId: string }
  | { kind: "link"; providerOrderId: string; url: string };

/**
 * Port for collecting payments. Clients pay Corpus365 centrally; partners are
 * paid from there. Order logic depends only on this interface.
 */
export interface PaymentGateway {
  readonly name: "test" | "razorpay";
  startCheckout(request: PaymentRequest): Promise<CheckoutStart>;
  createPaymentLink(request: PaymentRequest & { expiresAt: Date; callbackUrl: string }): Promise<LinkStart>;
  /** Verifies the proof of payment the browser returns after checkout. */
  verifyCheckout(input: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean;
}

/** Raised when the provider is unreachable or rejects a request. */
export class PaymentProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
