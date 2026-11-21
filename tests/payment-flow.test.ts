import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import * as t from "@/server/db/schema";
import { setMailer } from "@/server/mail/mailer";
import { setPaymentGateway } from "@/server/payments";
import type { CheckoutStart, LinkStart, PaymentGateway, PaymentRequest } from "@/server/payments/gateway";
import { verifyCheckoutSignature } from "@/server/payments/razorpay/signatures";
import { checkout, createRenewalOrder, renewSubscription, type PaymentOutcome } from "@/server/services/order.service";
import { confirmCheckout, recordProviderPayment } from "@/server/services/payment.service";
import { processDueRenewals } from "@/server/services/billing.service";
import { addDays } from "@/domain/pricing";
import { rupees } from "@/domain/money";

const KEY_SECRET = "rzp_secret_for_tests";

/** Behaves like Razorpay: checkout needs browser confirmation, renewals go by link. */
class FakeRazorpay implements PaymentGateway {
  readonly name = "razorpay" as const;
  private seq = 0;
  async startCheckout(request: PaymentRequest): Promise<CheckoutStart> {
    const providerOrderId = `order_${++this.seq}`;
    return {
      kind: "checkout",
      providerOrderId,
      session: { provider: "razorpay", keyId: "rzp_test_x", providerOrderId, amount: request.amount, currency: "INR", name: "Corpus365", description: request.description, prefill: { name: request.customer.name, email: request.customer.email } },
    };
  }
  async createPaymentLink(): Promise<LinkStart> {
    const id = `plink_${++this.seq}`;
    return { kind: "link", providerOrderId: id, url: `https://rzp.io/i/${id}` };
  }
  verifyCheckout(input: { providerOrderId: string; providerPaymentId: string; signature: string }) {
    return verifyCheckoutSignature({ orderId: input.providerOrderId, paymentId: input.providerPaymentId, signature: input.signature, keySecret: KEY_SECRET });
  }
}

const sign = (orderId: string, paymentId: string) => createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

let product: t.Product;
let yearly: t.Plan;
let partner: t.User;
let client: t.User;
let seq = 0;

function newClient(): t.User {
  return db
    .insert(t.users)
    .values({ email: `c${++seq}@example.com`, name: "Client", companyName: `Biz ${seq}`, role: "client", passwordHash: "x", referredByPartnerId: partner.id })
    .returning()
    .get();
}

function pending(outcome: PaymentOutcome) {
  if (outcome.status !== "pending") throw new Error("expected a pending payment");
  return outcome;
}

const commissionsFor = (orderId: string) => db.select().from(t.commissions).where(eq(t.commissions.orderId, orderId)).all();
const orderById = (id: string) => db.select().from(t.orders).where(eq(t.orders.id, id)).get()!;

beforeAll(() => {
  setMailer({ send: async () => {} });
  setPaymentGateway(new FakeRazorpay());
  product = db
    .insert(t.products)
    .values({ slug: "gym", name: "Gym App", type: "app", category: "Fitness", tagline: "t", description: "d", features: [], worksWith: [], status: "live", icon: "dumbbell", trialDays: 14 })
    .returning()
    .get();
  yearly = db.insert(t.plans).values({ productId: product.id, name: "Yearly", interval: "year", price: rupees(12_000) }).returning().get();
  partner = db.insert(t.users).values({ email: "p@example.com", name: "Partner", role: "partner", passwordHash: "x" }).returning().get();
  db.insert(t.partnerProfiles)
    .values({ userId: partner.id, code: "PART1", status: "approved", profession: "Accountant", region: "Kerala", agreementAcceptedAt: new Date(), approvedAt: addDays(new Date(), -365) })
    .run();
});

beforeEach(() => {
  client = newClient();
});

async function buy() {
  return pending(
    await checkout({ buyer: client, lines: [{ productId: product.id, planId: yearly.id, quantity: 1 }], billing: { billingName: client.name } }),
  );
}

describe("Razorpay checkout flow", () => {
  it("creates a pending order and fulfils nothing until payment is verified", async () => {
    const { order, payment } = await buy();
    expect(orderById(order.id)).toMatchObject({ status: "pending", paymentProvider: "razorpay", providerOrderId: payment.session.providerOrderId });
    expect(payment.session.amount).toBe(rupees(14_160)); // incl. 18% GST
    expect(db.select().from(t.subscriptions).where(eq(t.subscriptions.userId, client.id)).all()).toHaveLength(0);
    expect(commissionsFor(order.id)).toHaveLength(0);
  });

  it("fulfils once on a valid signature, and repeated confirmations are harmless", async () => {
    const { order, payment } = await buy();
    const proof = { orderId: order.id, userId: client.id, providerOrderId: payment.session.providerOrderId, providerPaymentId: "pay_1", signature: sign(payment.session.providerOrderId, "pay_1") };

    await confirmCheckout(proof);
    await confirmCheckout(proof); // browser retry
    await recordProviderPayment({ providerOrderId: payment.session.providerOrderId, providerPaymentId: "pay_1", amount: order.total }); // webhook

    expect(orderById(order.id)).toMatchObject({ status: "paid", paymentReference: "pay_1" });
    expect(db.select().from(t.subscriptions).where(eq(t.subscriptions.userId, client.id)).all()).toMatchObject([{ status: "active" }]);
    expect(commissionsFor(order.id).filter((c) => c.kind === "sale")).toHaveLength(1);
  });

  it("rejects a forged signature", async () => {
    const { order, payment } = await buy();
    await expect(
      confirmCheckout({ orderId: order.id, userId: client.id, providerOrderId: payment.session.providerOrderId, providerPaymentId: "pay_2", signature: sign("order_other", "pay_2") }),
    ).rejects.toThrow(/couldn’t verify/);
    expect(orderById(order.id).status).toBe("pending");
  });

  it("refuses to confirm someone else's order", async () => {
    const { order, payment } = await buy();
    const intruder = newClient();
    await expect(
      confirmCheckout({ orderId: order.id, userId: intruder.id, providerOrderId: payment.session.providerOrderId, providerPaymentId: "pay_3", signature: sign(payment.session.providerOrderId, "pay_3") }),
    ).rejects.toThrow(/couldn’t match/);
  });

  it("fulfils from the webhook alone when the customer closed the browser", async () => {
    const { order, payment } = await buy();
    const result = await recordProviderPayment({ providerOrderId: payment.session.providerOrderId, providerPaymentId: "pay_4", amount: order.total });
    expect(result.handled).toBe(true);
    expect(orderById(order.id).status).toBe("paid");
  });

  it("never fulfils a payment whose amount does not match the order", async () => {
    const { order, payment } = await buy();
    const result = await recordProviderPayment({ providerOrderId: payment.session.providerOrderId, providerPaymentId: "pay_5", amount: 100 });
    expect(result).toMatchObject({ handled: false, reason: "amount mismatch" });
    expect(orderById(order.id).status).toBe("pending");
  });
});

describe("renewals", () => {
  async function activeSubscription() {
    const { order, payment } = await buy();
    await recordProviderPayment({ providerOrderId: payment.session.providerOrderId, providerPaymentId: `pay_${order.id}`, amount: order.total });
    return db.select().from(t.subscriptions).where(eq(t.subscriptions.userId, client.id)).get()!;
  }

  it("bills a due subscription by payment link, once, and renews from the old period end when paid", async () => {
    const sub = await activeSubscription();
    const periodEnd = addDays(new Date(), -1);
    db.update(t.subscriptions).set({ currentPeriodEnd: periodEnd }).where(eq(t.subscriptions.id, sub.id)).run();

    const first = await processDueRenewals();
    const second = await processDueRenewals(); // already has an outstanding link
    expect(first.linksSent).toBeGreaterThanOrEqual(1);
    const links = db.select().from(t.orders).where(eq(t.orders.subscriptionId, sub.id)).all();
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ status: "pending", paymentUrl: expect.stringContaining("rzp.io") });
    expect(second.linksSent).toBe(0);

    await recordProviderPayment({ providerOrderId: links[0]!.providerOrderId!, providerPaymentId: "pay_link", amount: links[0]!.total });
    const renewed = db.select().from(t.subscriptions).where(eq(t.subscriptions.id, sub.id)).get()!;
    expect(renewed).toMatchObject({ status: "active", renewalCount: 1 });
    expect(renewed.currentPeriodStart.getTime()).toBe(periodEnd.getTime());
    expect(commissionsFor(links[0]!.id)).toMatchObject([{ kind: "renewal" }]);
  });

  it("lapses an unpaid subscription after the grace period", async () => {
    const sub = await activeSubscription();
    db.update(t.subscriptions).set({ currentPeriodEnd: addDays(new Date(), -1) }).where(eq(t.subscriptions.id, sub.id)).run();
    await processDueRenewals();
    await processDueRenewals(addDays(new Date(), 10));
    expect(db.select().from(t.subscriptions).where(eq(t.subscriptions.id, sub.id)).get()!.status).toBe("expired");
  });

  it("client-initiated renewal goes through checkout", async () => {
    const sub = await activeSubscription();
    const outcome = pending(await renewSubscription({ subscriptionId: sub.id, userId: client.id }));
    expect(outcome.order.kind).toBe("renewal");
    expect(() => createRenewalOrder(sub.id, new Date(), newClient().id)).toThrow(/not found/);
  });
});
