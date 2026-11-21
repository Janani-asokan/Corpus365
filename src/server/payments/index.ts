import type { PaymentGateway } from "./gateway";
import { TestPaymentGateway } from "./test-gateway";
import { RazorpayGateway } from "./razorpay/gateway";

/**
 * Chooses the payment provider from the environment:
 *   PAYMENT_PROVIDER=razorpay  needs RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
 *   PAYMENT_PROVIDER=test      instant fake payments (development only)
 * Production refuses test payments unless ALLOW_TEST_PAYMENTS=true, so a missing
 * key can never silently give products away.
 */
export interface PaymentStatus {
  provider: "test" | "razorpay";
  ready: boolean;
  /** Why payments are disabled, for logs and the admin dashboard. */
  problem?: string;
  /** Razorpay key mode, from the key id prefix. */
  keyMode?: "test" | "live";
}

let override: PaymentGateway | null = null;
let cached: { signature: string; gateway: PaymentGateway } | null = null;

export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}

export function razorpaySecrets() {
  return {
    keyId: process.env.RAZORPAY_KEY_ID?.trim() ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET?.trim() ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "",
    apiBase: (process.env.RAZORPAY_API_BASE ?? "https://api.razorpay.com/v1").replace(/\/$/, ""),
  };
}

export function paymentStatus(): PaymentStatus {
  if (override) return { provider: override.name, ready: true };

  const requested = process.env.PAYMENT_PROVIDER ?? (process.env.RAZORPAY_KEY_ID ? "razorpay" : "test");
  if (requested === "razorpay") {
    const { keyId, keySecret, webhookSecret } = razorpaySecrets();
    const missing = [
      !keyId && "RAZORPAY_KEY_ID",
      !keySecret && "RAZORPAY_KEY_SECRET",
      !webhookSecret && "RAZORPAY_WEBHOOK_SECRET",
    ].filter(Boolean);
    if (missing.length) return { provider: "razorpay", ready: false, problem: `Missing ${missing.join(", ")}.` };
    if (!/^rzp_(test|live)_/.test(keyId)) return { provider: "razorpay", ready: false, problem: "RAZORPAY_KEY_ID should start with rzp_test_ or rzp_live_." };
    return { provider: "razorpay", ready: true, keyMode: keyId.startsWith("rzp_live_") ? "live" : "test" };
  }

  if (requested !== "test") return { provider: "test", ready: false, problem: `Unknown PAYMENT_PROVIDER "${requested}".` };
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_PAYMENTS !== "true") {
    return { provider: "test", ready: false, problem: "Test payments are disabled in production. Configure Razorpay." };
  }
  return { provider: "test", ready: true };
}

export function paymentGateway(): PaymentGateway {
  if (override) return override;
  const status = paymentStatus();
  if (!status.ready) throw new PaymentConfigError(status.problem ?? "Payments are not configured.");

  const secrets = razorpaySecrets();
  const signature = `${status.provider}:${secrets.keyId}:${secrets.apiBase}`;
  if (cached?.signature !== signature) {
    const gateway =
      status.provider === "razorpay"
        ? new RazorpayGateway({ keyId: secrets.keyId, keySecret: secrets.keySecret, apiBase: secrets.apiBase })
        : new TestPaymentGateway();
    cached = { signature, gateway };
  }
  return cached.gateway;
}

/** For seeding and tests. Pass null to return to environment configuration. */
export function setPaymentGateway(next: PaymentGateway | null): void {
  override = next;
}
