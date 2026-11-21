"use client";

import { createContext, useActionState, useContext, type ComponentProps } from "react";
import { initialActionState, type ActionState } from "@/lib/validation";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/** Fields never echoed back into the form after a failed submit. */
const SENSITIVE = /password|token/i;

function valuesOf(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && !SENSITIVE.test(key)) values[key] = value;
  }
  return values;
}

/**
 * `useActionState` that remembers what the user typed when a submit fails.
 * React resets forms after an action completes; without this, one validation
 * error would wipe every field.
 */
export function useFormAction(action: Action) {
  return useActionState(async (previous: ActionState, form: FormData) => {
    const result = await action(previous, form);
    return result.ok ? result : { ...result, values: valuesOf(form) };
  }, initialActionState);
}

const FormValuesContext = createContext<Record<string, string> | undefined>(undefined);

/** Inputs inside read their previous value from here after a failed submit. */
export function Form({ state, ...props }: ComponentProps<"form"> & { state: ActionState }) {
  return (
    <FormValuesContext.Provider value={state.ok ? undefined : state.values}>
      <form noValidate {...props} />
    </FormValuesContext.Provider>
  );
}

export function useSubmittedValue(name: string | undefined): string | undefined {
  const values = useContext(FormValuesContext);
  return name ? values?.[name] : undefined;
}
