/** First row of a query result, or undefined. */
export async function first<T>(query: PromiseLike<T[]>): Promise<T | undefined> {
  const rows = await query;
  return rows[0];
}

/** First row of a query that must return one (e.g. INSERT … RETURNING). */
export async function single<T>(query: PromiseLike<T[]>): Promise<T> {
  const rows = await query;
  if (rows.length === 0) throw new Error("Expected a row but the query returned none");
  return rows[0]!;
}

/** Postgres unique_violation, optionally for a specific constraint. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint?: string };
  return pg?.code === "23505" && (!constraint || pg.constraint === constraint);
}
