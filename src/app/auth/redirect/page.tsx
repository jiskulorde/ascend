// src/app/auth/redirect/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";

export default function AuthRedirect() {
  const supabase = browserSupabase();
  const search = useSearchParams();
  const router = useRouter();
  const next = search.get("next") || "/dashboard";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("No session found. Please sign in again.");
          return;
        }
        const user = session.user;

        // Ensure a profile row exists
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from("profiles").upsert({ id: user.id, role: "CLIENT" });
        }

        router.replace(next);
      } catch (e: any) {
        setError(e.message ?? "Auth redirect failed");
      }
    })();
  }, [router, supabase, next]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
          {error ? (
            <>
              <h1 className="text-lg font-semibold">Something went wrong</h1>
              <p className="mt-2 text-sm text-red-600">{error}</p>
              <p className="mt-3 text-sm">
                <a className="underline" href="/auth/login">Back to sign in</a>
              </p>
            </>
          ) : (
            <>
              <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
              <div className="mt-3 h-10 w-full animate-pulse rounded bg-gray-200" />
              <p className="mt-3 text-sm text-muted-foreground">Finalizing your sign-in…</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
