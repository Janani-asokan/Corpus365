import { randomUUID } from "node:crypto";
import type { ChargeRequest, ChargeResult, PaymentGateway } from "./gateway";

/** Test-mode adapter: approves every charge. Never use in production. */
export class TestPaymentGateway implements PaymentGateway {
  readonly name = "test";

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (request.amount <= 0) return { ok: false, reason: "Amount must be positive." };
    return { ok: true, providerReference: `test_${randomUUID()}` };
  }
}
