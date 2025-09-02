import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Use in Server Components (RSC) and loaders.
 * Reads cookies, but does NOT attempt to set them (no-op setAll),
 * because Next.js only allows cookie writes in actions/route handlers.
 */
export async function serverSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        // no-op in RSC
        setAll() {},
      },
    }
  );
}

/**
 * Use ONLY in Route Handlers or Server Actions.
 * Reads & sets cookies (allowed in those contexts).
 */
export async function actionSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        },
      },
    }
  );
}
