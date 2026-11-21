"use client";

import { useActionState, useState } from "react";
import { addToCartAction } from "@/server/actions/shop.actions";
import { initialActionState } from "@/lib/validation";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

interface PlanOption {
  id: string;
  name: string;
  priceLabel: string;
  interval: "month" | "year";
  note?: string;
}

export function AppPlanForm({ productId, plans }: { productId: string; plans: PlanOption[] }) {
  const [state, action] = useActionState(addToCartAction, initialActionState);
  const [selected, setSelected] = useState(plans.find((p) => p.interval === "year")?.id ?? plans[0]?.id);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Choose a subscription term</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {plans.map((plan) => (
            <label
              key={plan.id}
              className={cn(
                "flex cursor-pointer flex-col rounded-xl border-2 bg-white p-4 transition",
                selected === plan.id ? "border-brand" : "border-line hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="planId"
                value={plan.id}
                checked={selected === plan.id}
                onChange={() => setSelected(plan.id)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2 text-sm font-medium">
                {plan.name}
                {plan.note && <span className="rounded-full bg-accent-tint px-2 py-0.5 text-xs">{plan.note}</span>}
              </span>
              <span className="mt-1 font-display text-2xl font-semibold">
                {plan.priceLabel}
                <span className="text-sm font-normal text-ink-muted">/{plan.interval}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingLabel="Adding…">Add to cart</SubmitButton>
      <p className="text-xs text-ink-muted">Prices exclude 18% GST. Licence and login are sent instantly after payment.</p>
    </form>
  );
}

export function HardwareForm({ productId, priceLabel }: { productId: string; priceLabel: string }) {
  const [state, action] = useActionState(addToCartAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <p className="font-display text-3xl font-semibold">
        {priceLabel} <span className="text-sm font-normal text-ink-muted">per unit, excl. GST</span>
      </p>
      <div className="flex items-end gap-3">
        <div className="w-28">
          <label htmlFor="quantity" className="mb-1.5 block text-sm font-medium">Quantity</label>
          <Input id="quantity" name="quantity" type="number" inputMode="numeric" min={1} max={50} defaultValue={1} required />
        </div>
        <SubmitButton size="lg" className="flex-1" pendingLabel="Adding…">Add to cart</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
