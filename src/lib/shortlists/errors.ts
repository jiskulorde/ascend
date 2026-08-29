// src/lib/shortlists/errors.ts

import { NextResponse } from "next/server";

const GENERIC_SERVER_ERROR = "Something went wrong. Please try again.";

/**
 * Use for any unexpected Supabase/Postgres error. Logs the real error
 * server-side (with a call-site label for grep-ability) but never forwards
 * error.message to the client — raw DB errors can reveal schema/constraint
 * details that shouldn't be exposed over the API.
 */
export function serverError(context: string, error: unknown) {
  console.error(`[shortlists] ${context}`, error);
  return NextResponse.json({ error: GENERIC_SERVER_ERROR }, { status: 500 });
}
