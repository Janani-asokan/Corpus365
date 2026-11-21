import "server-only";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import { db } from "@/server/db/client";
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
  db.insert(sessions).values({ id: sha256(token), userId, expiresAt }).run();
  await setSessionCookie(token, expiresAt);
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "companyName" | "phone" | "city">;

export async function readSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE.session)?.value;
  if (!token) return null;

  const row = db
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
    .get();

  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    db.delete(sessions).where(eq(sessions.id, row.sessionId)).run();
    return null;
  }

  // Sliding expiry: extend active sessions. Cookies can only be written from
  // actions/route handlers, so only the database row is extended here and the
  // cookie is refreshed on the next sign-in-protected mutation.
  if (row.expiresAt.getTime() - Date.now() < REFRESH_WHEN_DAYS_LEFT * DAY) {
    db.update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * DAY) })
      .where(eq(sessions.id, row.sessionId))
      .run();
  }

  const { sessionId: _sessionId, expiresAt: _expiresAt, ...user } = row;
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE.session)?.value;
  if (token) db.delete(sessions).where(eq(sessions.id, sha256(token))).run();
  store.delete(COOKIE.session);
}

/** Signs the user out everywhere (e.g. after a password reset). */
export function revokeAllSessions(userId: string): void {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

export function purgeExpiredSessions(): void {
  db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
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
