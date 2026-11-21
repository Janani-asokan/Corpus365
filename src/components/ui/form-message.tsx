import type { ActionState } from "@/lib/validation";
import { Alert } from "./alert";

/** Shows the top-level result of a form action (success or error). */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>;
}
