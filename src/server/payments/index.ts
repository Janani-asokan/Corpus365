import type { PaymentGateway } from "./gateway";
import { TestPaymentGateway } from "./test-gateway";

let gateway: PaymentGateway = new TestPaymentGateway();

export function paymentGateway(): PaymentGateway {
  return gateway;
}

/** For tests and for wiring a real provider at start-up. */
export function setPaymentGateway(next: PaymentGateway): void {
  gateway = next;
}
