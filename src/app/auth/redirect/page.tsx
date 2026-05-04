// src/app/auth/redirect/page.tsx

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function RedirectHandler() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const next = useMemo(() => safeNextPath(searchParams.get("next")), [searchParams]);
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
        window.location.replace(next);
      } catch (error: any) {
        console.error("OAuth redirect error:", error?.message || error);
        if (active) setMessage(error?.message || "Sign in failed. Please try again.");
      }
    }

    handleOAuth();

    return () => {
      active = false;
    };
  }, [code, next]);

  return <p className="mt-10 text-center text-sm text-muted-foreground">{message}</p>;
}

export default function RedirectPage() {
  return (
    <Suspense fallback={<p className="mt-10 text-center text-sm text-muted-foreground">Loading…</p>}>
      <RedirectHandler />
    </Suspense>
  );
}