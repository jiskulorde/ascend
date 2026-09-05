// src/lib/shortlists/ids.ts

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Route params (shortlist id, shortlist_unit id) are passed straight into
 * .eq() calls against uuid columns. Without this check, a malformed id
 * reaches Postgres, which throws "invalid input syntax for type uuid" —
 * that's a query error, not a "not found", and would otherwise fall through
 * to a generic 500. Validating shape first turns that into a clean 400.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
