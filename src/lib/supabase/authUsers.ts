// src/lib/supabase/authUsers.ts
import { adminSupabase } from "@/lib/supabase/admin";

const PAGE_SIZE = 1000;

/**
 * Server-only. Fetches every Supabase Auth user via the Admin API (service
 * role) and returns a Map of auth user id -> email.
 *
 * A missing key means no auth.users row exists for that id (a data
 * inconsistency to be handled by the caller); a key mapped to `null` means
 * the auth user exists but has no email on record.
 *
 * Callers MUST already have verified the requester is an authorized ADMIN
 * before invoking this — it exists precisely so email lookups never happen
 * from browser code, and it must not be called before that check.
 *
 * Paginates rather than assuming a single page covers every account, since
 * Auth Admin's listUsers() is paginated server-side.
 */
export async function getAuthEmailsByUserId(): Promise<Map<string, string | null>> {
  const admin = adminSupabase();
  const emailsById = new Map<string, string | null>();

  let page = 1;
  // Safety cap so a bug in the pagination condition can't spin forever.
  const MAX_PAGES = 1000;

  while (page <= MAX_PAGES) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const users = data?.users ?? [];
    for (const user of users) {
      emailsById.set(user.id, user.email ?? null);
    }

    if (users.length < PAGE_SIZE) break;
    page += 1;
  }

  return emailsById;
}
