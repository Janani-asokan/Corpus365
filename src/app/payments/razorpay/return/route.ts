import { NextResponse, type NextRequest } from "next/server";
import { razorpaySecrets } from "@/server/payments";
import { verifyPaymentLinkSignature } from "@/server/payments/razorpay/signatures";
import { recordProviderPayment } from "@/server/services/payment.service";

export const dynamic = "force-dynamic";

/** Where Razorpay sends the customer after paying a renewal payment link. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const paymentId = q.get("razorpay_payment_id") ?? "";
  const paymentLinkId = q.get("razorpay_payment_link_id") ?? "";
  const referenceId = q.get("razorpay_payment_link_reference_id") ?? "";
  const status = q.get("razorpay_payment_link_status") ?? "";
  const signature = q.get("razorpay_signature") ?? "";
  const failed = new URL("/account/subscriptions?payment=failed", request.url);

  const { keySecret } = razorpaySecrets();
  const valid =
    keySecret &&
    verifyPaymentLinkSignature({ paymentLinkId, referenceId, status, paymentId, signature, keySecret });
  if (!valid || status !== "paid") return NextResponse.redirect(failed);

  const result = await recordProviderPayment({ providerOrderId: paymentLinkId, providerPaymentId: paymentId });
  if (!result.handled || !result.order) return NextResponse.redirect(failed);
  return NextResponse.redirect(new URL(`/invoices/${result.order.id}?paid=1`, request.url));
}
