import type { CheckoutStart, LinkStart, PaymentGateway, PaymentRequest } from "../gateway";
import { RazorpayClient, type RazorpayConfig } from "./client";
import { verifyCheckoutSignature } from "./signatures";

/** Razorpay adapter: Standard Checkout for on-session payments, Payment Links for renewals. */
export class RazorpayGateway implements PaymentGateway {
  readonly name = "razorpay" as const;
  private readonly client: RazorpayClient;

  constructor(private readonly config: RazorpayConfig) {
    this.client = new RazorpayClient(config);
  }

  async startCheckout(request: PaymentRequest): Promise<CheckoutStart> {
    const order = await this.client.createOrder({
      amount: request.amount,
      currency: request.currency,
      receipt: request.reference.slice(0, 40),
      notes: { order_number: request.reference },
    });
    return {
      kind: "checkout",
      providerOrderId: order.id,
      session: {
        provider: "razorpay",
        keyId: this.config.keyId,
        providerOrderId: order.id,
        amount: request.amount,
        currency: request.currency,
        name: "Corpus365",
        description: request.description,
        prefill: { name: request.customer.name, email: request.customer.email, contact: request.customer.phone ?? undefined },
      },
    };
  }

  async createPaymentLink(request: PaymentRequest & { expiresAt: Date; callbackUrl: string }): Promise<LinkStart> {
    const contact = request.customer.phone?.replace(/[^\d+]/g, "");
    const link = await this.client.createPaymentLink({
      amount: request.amount,
      currency: request.currency,
      reference_id: request.reference.slice(0, 40),
      description: request.description.slice(0, 2048),
      customer: { name: request.customer.name, email: request.customer.email, ...(contact ? { contact } : {}) },
      notify: { sms: Boolean(contact), email: true },
      reminder_enable: true,
      callback_url: request.callbackUrl,
      callback_method: "get",
      expire_by: Math.floor(request.expiresAt.getTime() / 1000),
      notes: { order_number: request.reference },
    });
    return { kind: "link", providerOrderId: link.id, url: link.short_url };
  }

  verifyCheckout(input: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean {
    return verifyCheckoutSignature({
      orderId: input.providerOrderId,
      paymentId: input.providerPaymentId,
      signature: input.signature,
      keySecret: this.config.keySecret,
    });
  }
}
