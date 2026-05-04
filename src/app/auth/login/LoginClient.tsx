// src/app/auth/login/LoginClient.tsx

"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export default function LoginClient() {
  const search = useSearchParams();
  const next = useMemo(() => safeNextPath(search.get("next")), [search]);
  const supabase = browserSupabase();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  async function upsertProfile(userId: string) {
    const payload: Record<string, string> = {
      id: userId,
      role: "CLIENT",
    };

    if (fullName.trim()) payload.full_name = fullName.trim();
    if (phone.trim()) payload.phone = phone.trim();

    await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  }

  async function goToNext() {
    // Give Supabase a tiny moment to persist cookies, then force a real navigation.
    await new Promise((resolve) => setTimeout(resolve, 150));
    window.location.assign(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });

        if (error) throw error;

        await goToNext();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
      });

      if (error) throw error;

      const userId = data.user?.id;

      if (userId) {
        await upsertProfile(userId);
        await goToNext();
        return;
      }

      setErr("Check your email to confirm your account. You can sign in after verifying.");
    } catch (e: any) {
      setErr(e.message ?? "Something went wrong");
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setErr(null);
    setBusy(true);

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const redirectTo = `${siteUrl}/auth/redirect?next=${encodeURIComponent(next)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) throw error;
    } catch (e: any) {
      setErr(e.message ?? "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex gap-2 rounded-full bg-muted p-1">
          <button
            className={`flex-1 rounded-full px-3 py-2 text-sm ${
              mode === "signin"
                ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                : "hover:bg-muted/60"
            }`}
            onClick={() => setMode("signin")}
            type="button"
          >
            Sign in
          </button>

          <button
            className={`flex-1 rounded-full px-3 py-2 text-sm ${
              mode === "signup"
                ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                : "hover:bg-muted/60"
            }`}
            onClick={() => setMode("signup")}
            type="button"
          >
            Create account
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {err && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </p>
          )}

          {mode === "signup" && (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm text-muted-foreground">Full name optional</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
                  placeholder="Juan Dela Cruz"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Phone optional</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2"
                  placeholder="+63 912 345 6789"
                  autoComplete="tel"
                />
              </div>
            </div>
          )}

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
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>

          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy
              ? mode === "signin"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>

          <div className="relative my-2 text-center text-xs text-muted-foreground">
            <span className="relative z-10 bg-card px-2">or</span>
            <div className="absolute left-0 right-0 top-1/2 border-t border-border" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 transition hover:bg-muted"
          >
            Continue with Google
          </button>

          {mode === "signin" ? (
            <p className="text-center text-xs text-muted-foreground">
              Don’t have an account?{" "}
              <button type="button" onClick={() => setMode("signup")} className="underline">
                Create one
              </button>
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <button type="button" onClick={() => setMode("signin")} className="underline">
                Sign in
              </button>
            </p>
          )}
        </form>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        We keep sign-up simple: email and password. New users get a Client account by default.
      </p>
    </div>
  );
}