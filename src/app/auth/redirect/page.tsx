"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { useEffect } from "react";

function RedirectHandler() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code"); // ?code= from Supabase redirect

  useEffect(() => {
    async function handleOAuth() {
      if (code) {
        const supabase = browserSupabase();
        // Exchange the code for a session
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("OAuth error:", error.message);
        } else {
          window.location.href = "/dashboard"; // or wherever you want to land
        }
      }
    }
    handleOAuth();
  }, [code]);

  return <p className="text-center mt-10">Redirecting...</p>;
}

export default function RedirectPage() {
  return (
    <Suspense fallback={<p className="text-center mt-10">Loading...</p>}>
      <RedirectHandler />
    </Suspense>
  );
}
