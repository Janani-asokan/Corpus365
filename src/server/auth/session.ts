import "server-only";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { first } from "@/server/db/query";
import { sessions, users, type User } from "@/server/db/schema";
import { COOKIE, config } from "@/lib/config";
import { secureToken, sha256 } from "@/lib/random";

const SESSION_DAYS = 30;
const REFRESH_WHEN_DAYS_LEFT = 15;
const DAY = 86_400_000;

/**
 * Opaque database sessions: the cookie carries a random token, the database
 * stores only its SHA-256, so a leaked database cannot be replayed as cookies.
 * Sessions can be revoked server-side (logout, password change).
 */
export async function createSession(userId: string): Promise<void> {
  const token = secureToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  await setSessionCookie(token, expiresAt);
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "companyName" | "phone" | "city">;

export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE.session)?.value;
  if (!token) return null;

  const row = await first(
    db
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        companyName: users.companyName,
        phone: users.phone,
        city: users.city,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.id, sha256(token)))
      .limit(1),
  );

  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId));
    return null;
  }

  // Sliding expiry. Cookies can only be written from actions/route handlers,
  // so only the row is extended here; the cookie keeps its original expiry.
  if (row.expiresAt.getTime() - Date.now() < REFRESH_WHEN_DAYS_LEFT * DAY) {
    await db.update(sessions).set({ expiresAt: new Date(Date.now() + SESSION_DAYS * DAY) }).where(eq(sessions.id, row.sessionId));
  }

  const { sessionId: _sessionId, expiresAt: _expiresAt, ...user } = row;
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE.session)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  store.delete(COOKIE.session);
}

/** Signs the user out everywhere (e.g. after a password reset). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(COOKIE.session, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
