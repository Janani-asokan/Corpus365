import bcrypt from "bcryptjs";

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: Promise<string> | null = null;

/**
 * Compare against a throwaway hash when an account does not exist, so a
 * failed login takes the same time either way and does not reveal which
 * emails are registered.
 */
export async function verifyAgainstDummy(plain: string): Promise<false> {
  dummyHash ??= hashPassword("corpus365-dummy-password");
  await bcrypt.compare(plain, await dummyHash);
  return false;
}
