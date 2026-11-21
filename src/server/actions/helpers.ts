import "server-only";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { messageOf } from "@/lib/errors";
import type { ActionState } from "@/lib/validation";

/**
 * Runs a mutation and converts expected failures into form state. Framework
 * control-flow errors (redirect, notFound) are re-thrown untouched.
 */
export async function attempt(fn: () => unknown, success?: string): Promise<ActionState> {
  try {
    await fn();
    return { ok: true, message: success };
  } catch (error) {
    unstable_rethrow(error);
    const message = messageOf(error);
    if (message === messageOf(null)) console.error("[action] unexpected error", error);
    return { ok: false, message };
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
