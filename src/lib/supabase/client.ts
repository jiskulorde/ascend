"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anon) {
  throw new Error(
    "@supabase/ssr: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.\n" +
      "Check your .env.local and restart `npm run dev`."
  );
}

/**
 * Preferred: import { supabaseBrowser } from "@/lib/supabase/client"
 */
export const supabaseBrowser = createBrowserClient(url, anon);

/**
 * Backward-compatible shim so existing code like `browserSupabase()` keeps working.
 * You can delete this later and switch to `supabaseBrowser`.
 */
export function browserSupabase() {
  return supabaseBrowser;
}
