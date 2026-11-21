import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { first, isUniqueViolation, single } from "@/server/db/query";
import { partnerProfiles, passwordResetTokens, users, type User } from "@/server/db/schema";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/server/auth/password";
import { revokeAllSessions } from "@/server/auth/session";
import { getMailer } from "@/server/mail/mailer";
import { UserFacingError } from "@/lib/errors";
import { randomCode, secureToken, sha256 } from "@/lib/random";
import { config } from "@/lib/config";
import { audit } from "./audit.service";

const RESET_TOKEN_MINUTES = 30;
const EMAIL_TAKEN = "An account with this email already exists. Try signing in instead.";

export async function findUserByEmail(email: string): Promise<User | null> {
  return (await first(db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1))) ?? null;
}

export async function getUser(id: string): Promise<User | null> {
  return (await first(db.select().from(users).where(eq(users.id, id)).limit(1))) ?? null;
}

/** Returns the user only if the password matches; constant-ish time either way. */
export async function authenticate(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) return verifyAgainstDummy(password).then(() => null);
  return (await verifyPassword(password, user.passwordHash)) ? user : null;
}

async function assertEmailFree(email: string): Promise<void> {
  if (await findUserByEmail(email)) throw new UserFacingError(EMAIL_TAKEN);
}

/** The unique index is the real guard; this turns a race into a friendly message. */
function rethrowDuplicateEmail(error: unknown): never {
  if (isUniqueViolation(error, "users_email_key")) throw new UserFacingError(EMAIL_TAKEN);
  throw error;
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
  await assertEmailFree(input.email);
  const passwordHash = await hashPassword(input.password);
  const user = await single(db.insert(users).values({ ...input, role: "client", passwordHash }).returning()).catch(rethrowDuplicateEmail);

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
  await assertEmailFree(input.email);
  const passwordHash = await hashPassword(input.password);
  const code = await uniquePartnerCode(input.name);

  const user = await db
    .transaction(async (tx) => {
      const created = await single(
        tx
          .insert(users)
          .values({ name: input.name, email: input.email, phone: input.phone, city: input.city, role: "partner", passwordHash })
          .returning(),
      );
      await tx.insert(partnerProfiles).values({
        userId: created.id,
        code,
        status: "pending",
        profession: input.profession,
        region: input.region,
        experience: input.experience ?? null,
        agreementAcceptedAt: new Date(),
      });
      await audit(tx, { actorId: created.id, action: "partner.applied", entityId: created.id });
      return created;
    })
    .catch(rethrowDuplicateEmail);

  await getMailer().send({
    to: user.email,
    subject: "We received your Corpus365 partner application",
    text: `Hi ${user.name},\n\nThanks for applying to become a Corpus365 Channel Partner. There is no fee to join. We review applications within a few working days and will email you when your partner link is active.`,
  });
  return user;
}

/** Codes look like "ANU4K7Q": name-derived prefix plus random characters. */
async function uniquePartnerCode(name: string): Promise<string> {
  const prefix = (name.replace(/[^A-Za-z]/g, "").toUpperCase() + "XXX").slice(0, 3);
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = prefix + randomCode(4);
    const taken = await first(db.select({ code: partnerProfiles.code }).from(partnerProfiles).where(eq(partnerProfiles.code, code)).limit(1));
    if (!taken) return code;
  }
  throw new Error("Could not allocate a unique partner code");
}

export async function updateProfile(
  userId: string,
  input: { name: string; phone: string | null; companyName?: string | null; city?: string | null },
): Promise<void> {
  await db
    .update(users)
    .set({ name: input.name, phone: input.phone, companyName: input.companyName ?? null, city: input.city ?? null })
    .where(eq(users.id, userId));
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const user = await getUser(userId);
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    throw new UserFacingError("Your current password is incorrect.");
  }
  const passwordHash = await hashPassword(next);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  await audit(db, { actorId: userId, action: "user.password_changed", entityId: userId });
}

/** Always behaves the same whether or not the email exists (no account enumeration). */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user) return;

  const token = secureToken();
  await db
    .insert(passwordResetTokens)
    .values({ id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000) });

  await getMailer().send({
    to: user.email,
    subject: "Reset your Corpus365 password",
    text: `Hi ${user.name},\n\nUse this link within ${RESET_TOKEN_MINUTES} minutes to choose a new password:\n${config.appUrl}/reset-password?token=${token}\n\nIf you did not ask for this, you can ignore this email.`,
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  const userId = await db.transaction(async (tx) => {
    // Claim the token atomically so it can be used exactly once.
    const claimed = await first(
      tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.id, sha256(token)),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .returning({ userId: passwordResetTokens.userId }),
    );
    if (!claimed) throw new UserFacingError("This reset link is invalid or has expired. Please request a new one.");
    await tx.update(users).set({ passwordHash }).where(eq(users.id, claimed.userId));
    await audit(tx, { actorId: claimed.userId, action: "user.password_reset", entityId: claimed.userId });
    return claimed.userId;
  });
  await revokeAllSessions(userId);
}
