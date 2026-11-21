import { createHash, randomBytes } from "node:crypto";

/** Unambiguous alphabet (no 0/O, 1/I/L) for codes people read aloud or type. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/** Licence keys look like C365-ABCD-EFGH-JKMN-PQRS. */
export function licenceKey(): string {
  return ["C365", randomCode(4), randomCode(4), randomCode(4), randomCode(4)].join("-");
}

export function secureToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
