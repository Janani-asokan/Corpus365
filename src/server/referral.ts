import "server-only";
import { cookies } from "next/headers";
import { COOKIE } from "@/lib/config";

export async function readReferralCode(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE.referral)?.value;
  return value && /^[A-Z0-9]{4,12}$/.test(value) ? value : null;
}
