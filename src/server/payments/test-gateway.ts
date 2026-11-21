import { randomUUID } from "node:crypto";
import type { CheckoutStart, LinkStart, PaymentGateway, PaymentRequest } from "./gateway";

/** Test-mode adapter: every payment succeeds instantly. Refused in production. */
export class TestPaymentGateway implements PaymentGateway {
  readonly name = "test" as const;

  async startCheckout(request: PaymentRequest): Promise<CheckoutStart> {
    return this.settle(request);
  }

  async createPaymentLink(request: PaymentRequest): Promise<LinkStart> {
    return this.settle(request);
  }

  verifyCheckout(): boolean {
    return false; // test payments never go through a browser checkout
  }

  private settle(request: PaymentRequest) {
    if (request.amount <= 0) throw new Error("Amount must be positive.");
    return { kind: "paid" as const, providerOrderId: `test_order_${randomUUID()}`, providerPaymentId: `test_pay_${randomUUID()}` };
  }
}
