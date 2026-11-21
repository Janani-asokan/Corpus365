"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { confirmPaymentAction } from "@/server/actions/payment.actions";
import type { PendingPayment } from "@/lib/payment-types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let scriptLoading: Promise<void> | null = null;

/** Loads Razorpay Checkout once, only when someone actually pays. */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoading = null;
      reject(new Error("Could not load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return scriptLoading;
}

type Phase = "idle" | "opening" | "paying" | "confirming" | "cancelled" | "error";

/**
 * Completes a pending payment in Razorpay Checkout, then has the server verify
 * the signature and fulfil the order. Renders progress and recovery states.
 */
export function PaymentStep({ payment }: { payment?: PendingPayment }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>();

  const pay = useCallback(
    async (pending: PendingPayment) => {
      setError(undefined);
      setPhase("opening");
      try {
        await loadCheckout();
      } catch (e) {
        setError((e as Error).message);
        setPhase("error");
        return;
      }

      const { session } = pending;
      const checkout = new window.Razorpay!({
        key: session.keyId,
        order_id: session.providerOrderId,
        amount: session.amount,
        currency: session.currency,
        name: session.name,
        description: session.description,
        prefill: session.prefill,
        theme: { color: "#0b6b5c" },
        modal: { confirm_close: true, ondismiss: () => setPhase((p) => (p === "paying" ? "cancelled" : p)) },
        handler: async (response: RazorpaySuccess) => {
          setPhase("confirming");
          const result = await confirmPaymentAction({ orderId: pending.orderId, ...response });
          if (result.ok && result.redirectTo) {
            router.push(result.redirectTo);
            router.refresh();
          } else {
            setError(result.message);
            setPhase("error");
          }
        },
      });
      checkout.on("payment.failed", (response) => setError(response.error?.description));
      setPhase("paying");
      checkout.open();
    },
    [router],
  );

  useEffect(() => {
    if (payment) void pay(payment);
  }, [payment, pay]);

  if (!payment || phase === "idle") return null;

  if (phase === "cancelled" || phase === "error") {
    return (
      <div className="space-y-3">
        <Alert tone={phase === "error" ? "danger" : "warning"} title={phase === "error" ? "Payment not completed" : "Payment window closed"}>
          {error ?? "You haven’t been charged. You can try again whenever you’re ready."}
        </Alert>
        {phase === "cancelled" || !error?.includes("verify") ? (
          <Button onClick={() => pay(payment)}>Try payment again</Button>
        ) : null}
      </div>
    );
  }

  return (
    <p role="status" className="flex items-center gap-2 rounded-lg bg-brand-tint px-4 py-3 text-sm text-brand">
      {phase === "confirming" ? <ShieldCheck className="size-4" aria-hidden /> : <Loader2 className="size-4 animate-spin" aria-hidden />}
      {phase === "confirming" ? "Payment received — confirming with Razorpay…" : phase === "opening" ? "Opening secure payment…" : "Complete your payment in the Razorpay window."}
    </p>
  );
}
