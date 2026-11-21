import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/domain/constants";
import { readSession, type SessionUser } from "./session";

/** The signed-in user for this request (memoised per request). */
export const getCurrentUser = cache(readSession);

export const HOME_FOR_ROLE: Record<Role, string> = {
  client: "/account",
  partner: "/partner",
  admin: "/admin",
};

/**
 * Ensures a signed-in user with one of the given roles. Used by every
 * protected layout, page and server action: middleware only checks that a
 * session cookie exists, authorisation always happens here on the server.
 */
export async function requireUser(roles?: readonly Role[], nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  }
  if (roles && !roles.includes(user.role)) redirect(HOME_FOR_ROLE[user.role]);
  return user;
}
