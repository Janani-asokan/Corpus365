import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { partnerProfiles, passwordResetTokens, users, type User } from "@/server/db/schema";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/server/auth/password";
import { revokeAllSessions } from "@/server/auth/session";
import { getMailer } from "@/server/mail/mailer";
import { UserFacingError } from "@/lib/errors";
import { randomCode, secureToken, sha256 } from "@/lib/random";
import { config } from "@/lib/config";
import { audit } from "./audit.service";

const RESET_TOKEN_MINUTES = 30;

export function findUserByEmail(email: string): User | null {
  return db.select().from(users).where(eq(users.email, email.toLowerCase())).get() ?? null;
}

export function getUser(id: string): User | null {
  return db.select().from(users).where(eq(users.id, id)).get() ?? null;
}

/** Returns the user only if the password matches; constant-ish time either way. */
export async function authenticate(email: string, password: string): Promise<User | null> {
  const user = findUserByEmail(email);
  if (!user) return verifyAgainstDummy(password).then(() => null);
  return (await verifyPassword(password, user.passwordHash)) ? user : null;
}

function assertEmailFree(email: string): void {
  if (findUserByEmail(email)) {
    throw new UserFacingError("An account with this email already exists. Try signing in instead.");
  }
}

export async function registerClient(input: {
  name: string;
  email: string;
  password: string;
  companyName: string;
  phone: string;
  city: string;
  referredByPartnerId: string | null;
}): Promise<User> {
  assertEmailFree(input.email);
  const passwordHash = await hashPassword(input.password);
  const user = db
    .insert(users)
    .values({ ...input, role: "client", passwordHash })
    .returning()
    .get();

  await getMailer().send({
    to: user.email,
    subject: "Welcome to Corpus365",
    text: `Hi ${user.name},\n\nYour Corpus365 account for ${input.companyName} is ready. Start a free trial any time at ${config.appUrl}/marketplace.`,
  });
  return user;
}

export async function registerPartnerApplication(input: {
  name: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  region: string;
  profession: string;
  experience?: string | null;
}): Promise<User> {
  assertEmailFree(input.email);
  const passwordHash = await hashPassword(input.password);

  const user = db.transaction((tx) => {
    const created = tx
      .insert(users)
      .values({ name: input.name, email: input.email, phone: input.phone, city: input.city, role: "partner", passwordHash })
      .returning()
      .get();
    tx.insert(partnerProfiles)
      .values({
        userId: created.id,
        code: uniquePartnerCode(input.name),
        status: "pending",
        profession: input.profession,
        region: input.region,
        experience: input.experience ?? null,
        agreementAcceptedAt: new Date(),
      })
      .run();
    audit(tx, { actorId: created.id, action: "partner.applied", entityId: created.id });
    return created;
  });

  await getMailer().send({
    to: user.email,
    subject: "We received your Corpus365 partner application",
    text: `Hi ${user.name},\n\nThanks for applying to become a Corpus365 Channel Partner. There is no fee to join. We review applications within a few working days and will email you when your partner link is active.`,
  });
  return user;
}

/** Codes look like "ANU4K7Q": name-derived prefix plus random characters. */
function uniquePartnerCode(name: string): string {
  const prefix = (name.replace(/[^A-Za-z]/g, "").toUpperCase() + "XXX").slice(0, 3);
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = prefix + randomCode(4);
    const taken = db.select({ code: partnerProfiles.code }).from(partnerProfiles).where(eq(partnerProfiles.code, code)).get();
    if (!taken) return code;
  }
  throw new Error("Could not allocate a unique partner code");
}

export function updateProfile(
  userId: string,
  input: { name: string; phone: string | null; companyName?: string | null; city?: string | null },
): void {
  db.update(users)
    .set({ name: input.name, phone: input.phone, companyName: input.companyName ?? null, city: input.city ?? null })
    .where(eq(users.id, userId))
    .run();
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const user = getUser(userId);
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    throw new UserFacingError("Your current password is incorrect.");
  }
  const passwordHash = await hashPassword(next);
  db.update(users).set({ passwordHash }).where(eq(users.id, userId)).run();
  audit(db, { actorId: userId, action: "user.password_changed", entityId: userId });
}

/** Always behaves the same whether or not the email exists (no account enumeration). */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = findUserByEmail(email);
  if (!user) return;

  const token = secureToken();
  db.insert(passwordResetTokens)
    .values({ id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000) })
    .run();

  await getMailer().send({
    to: user.email,
    subject: "Reset your Corpus365 password",
    text: `Hi ${user.name},\n\nUse this link within ${RESET_TOKEN_MINUTES} minutes to choose a new password:\n${config.appUrl}/reset-password?token=${token}\n\nIf you did not ask for this, you can ignore this email.`,
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const row = db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.id, sha256(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .get();
  if (!row) throw new UserFacingError("This reset link is invalid or has expired. Please request a new one.");

  const passwordHash = await hashPassword(password);
  db.transaction((tx) => {
    tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId)).run();
    tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id)).run();
    audit(tx, { actorId: row.userId, action: "user.password_reset", entityId: row.userId });
  });
  revokeAllSessions(row.userId);
}
