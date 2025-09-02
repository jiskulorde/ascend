// src/app/auth/login/LoginClient.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";

export default function LoginClient() {
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const router = useRouter();
  const supabase = browserSupabase();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    // go to ?next=… or dashboard
    router.push(next);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in</h1>
        {err && (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </p>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Password</label>
            <input
              type="password"
              required
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary mt-5 w-full"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Don’t have an account?{" "}
          <a href="/auth/login" className="underline">
            Create account
          </a>
        </p>
      </form>
    </div>
  );
}
