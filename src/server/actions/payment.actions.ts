"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { writeCartLines } from "@/server/cart";
import { confirmCheckout, nextPathAfterPayment } from "@/server/services/payment.service";
import { attempt } from "./helpers";

const confirmSchema = z.object({
  orderId: z.string().min(1).max(64),
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});

/**
 * Called by the browser after Razorpay Checkout succeeds. The signature is
 * verified server-side before anything is fulfilled; where to go next is
 * decided here, never by the client.
 */
export async function confirmPaymentAction(input: z.input<typeof confirmSchema>): Promise<{ ok: boolean; message?: string; redirectTo?: string }> {
  const user = await requireUser();
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "We couldn’t verify this payment. If you were charged, contact support." };

  let redirectTo = "";
  let kind = "";
  const result = await attempt(async () => {
    const order = await confirmCheckout({
      orderId: parsed.data.orderId,
      userId: user.id,
      providerOrderId: parsed.data.razorpay_order_id,
      providerPaymentId: parsed.data.razorpay_payment_id,
      signature: parsed.data.razorpay_signature,
    });
    redirectTo = nextPathAfterPayment(order);
    kind = order.kind;
  });
  if (!result.ok) return { ok: false, message: result.message };

  if (kind === "retail") await writeCartLines([]);
  revalidatePath("/", "layout");
  return { ok: true, redirectTo };
}
