import { PaymentProviderError } from "../gateway";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  /** Overridable only to point at a local stand-in in tests. */
  apiBase: string;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface RazorpayPaymentLink {
  id: string;
  short_url: string;
  status: string;
  reference_id: string;
}

const TIMEOUT_MS = 15_000;

/** Minimal typed client for the two Razorpay endpoints we use (Basic auth, JSON). */
export class RazorpayClient {
  constructor(private readonly config: RazorpayConfig) {}

  createOrder(body: { amount: number; currency: string; receipt: string; notes?: Record<string, string> }) {
    return this.post<RazorpayOrder>("/orders", body);
  }

  createPaymentLink(body: {
    amount: number;
    currency: string;
    reference_id: string;
    description: string;
    customer: { name: string; email: string; contact?: string };
    notify: { sms: boolean; email: boolean };
    reminder_enable: boolean;
    callback_url: string;
    callback_method: "get";
    expire_by: number;
    notes?: Record<string, string>;
  }) {
    return this.post<RazorpayPaymentLink>("/payment_links", body);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const auth = Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString("base64");
    let response: Response;
    try {
      response = await fetch(`${this.config.apiBase}${path}`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new PaymentProviderError(`Razorpay unreachable: ${(error as Error).message}`);
    }

    const data = (await response.json().catch(() => null)) as (T & { error?: { description?: string } }) | null;
    if (!response.ok || !data) {
      throw new PaymentProviderError(`Razorpay ${path} failed: ${data?.error?.description ?? response.statusText}`, response.status);
    }
    return data;
  }
}
