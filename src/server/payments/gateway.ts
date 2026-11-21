import type { Minor } from "@/domain/money";

export interface ChargeRequest {
  amount: Minor;
  currency: "INR";
  /** Our order number, used as the idempotency key with the provider. */
  reference: string;
  description: string;
  customerEmail: string;
}

export type ChargeResult = { ok: true; providerReference: string } | { ok: false; reason: string };

/**
 * Port for collecting payments. Clients pay Corpus365 centrally; partners are
 * paid from there. Swap the adapter (e.g. Razorpay, Stripe) without touching
 * order logic.
 */
export interface PaymentGateway {
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}
