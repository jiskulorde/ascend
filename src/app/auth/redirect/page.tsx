// src/app/auth/redirect/page.tsx

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { parseExplicitNext, resolvePostLoginDestination } from "@/lib/auth/postLoginDestination";

function RedirectHandler() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const explicitNext = useMemo(() => parseExplicitNext(searchParams.get("next")), [searchParams]);
  const [message, setMessage] = useState("Completing sign in…");

  useEffect(() => {
    let active = true;

    async function handleOAuth() {
      const supabase = browserSupabase();

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 150));

        if (!active) return;

        // No explicit ?next= carried through from the login page: resolve a
        // role-aware default now that the OAuth round trip is done and the
        // signed-in user is known (sellers -> Dashboard, everyone else,
        // including CLIENT -> Home). An explicit next is always honored as-is.
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const destination = user
          ? await resolvePostLoginDestination(supabase, user.id, explicitNext)
          : explicitNext ?? "/";

        if (!active) return;
        window.location.replace(destination);
      } catch (error: any) {
        console.error("OAuth redirect error:", error?.message || error);
        if (active) setMessage(error?.message || "Sign in failed. Please try again.");
      }
    }

    handleOAuth();

    return () => {
      active = false;
    };
  }, [code, explicitNext]);

  return <p className="mt-10 text-center text-sm text-muted-foreground">{message}</p>;
}

export default function RedirectPage() {
  return (
    <Suspense fallback={<p className="mt-10 text-center text-sm text-muted-foreground">Loading…</p>}>
      <RedirectHandler />
    </Suspense>
  );
}