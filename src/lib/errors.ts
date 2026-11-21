/**
 * An error whose message is safe to show to the user. Services throw this for
 * expected business-rule failures; anything else is treated as unexpected.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function messageOf(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof UserFacingError ? error.message : fallback;
}
