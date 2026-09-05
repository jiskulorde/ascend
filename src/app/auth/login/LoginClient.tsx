// src/app/auth/login/LoginClient.tsx

"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { parseExplicitNext, resolvePostLoginDestination } from "@/lib/auth/postLoginDestination";

type RequestedRole = "CLIENT" | "AGENT" | "MANAGER";

const ACCOUNT_TYPE_OPTIONS: { value: RequestedRole; label: string }[] = [
  { value: "CLIENT", label: "Buyer / Client" },
  { value: "AGENT", label: "Property Consultant / Agent" },
  { value: "MANAGER", label: "Manager" },
];

export default function LoginClient() {
  const search = useSearchParams();
  const explicitNext = useMemo(() => parseExplicitNext(search.get("next")), [search]);
  const supabase = browserSupabase();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const [fullName, setFullName] = useState("");
  const [requestedRole, setRequestedRole] = useState<RequestedRole>("CLIENT");

  async function goToDestination(destination: string) {
    // Give Supabase a tiny moment to persist cookies, then force a real navigation.
    await new Promise((resolve) => setTimeout(resolve, 150));
    window.location.assign(destination);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });

        if (error) throw error;

        // No explicit ?next= (e.g. clicking "Sign in" from the navbar, not a
        // redirected protected-route attempt): send sellers to their
        // Dashboard, everyone else Home — an explicit next is always
        // honored as-is regardless of role, see resolvePostLoginDestination.
        const destination = data.user
          ? await resolvePostLoginDestination(supabase, data.user.id, explicitNext)
          : explicitNext ?? "/";

        await goToDestination(destination);
        return;
      }

      // Picked up by the public.handle_new_user() trigger on auth.users,
      // which is what actually creates the profiles row (id, full_name,
      // requested_role — sanitized independently by the trigger itself,
      // never trusted as-is). Nothing here is browser-writable on profiles
      // directly. The account is created PENDING regardless of
      // requested_role — this only records what was asked for, for an
      // Admin to review; it never becomes the authoritative role by itself.
      const metadata: Record<string, string> = { requested_role: requestedRole };
      if (fullName.trim()) metadata.full_name = fullName.trim();

      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: metadata },
      });

      if (error) throw error;

      if (data.user?.id) {
        const destination = await resolvePostLoginDestination(supabase, data.user.id, explicitNext);
        await goToDestination(destination);
        return;
      }

      setErr(
        "Check your email to verify your account. Once verified, sign in — your account will remain pending until an administrator approves it."
      );
    } catch (e: any) {
      setErr(e.message ?? "Something went wrong");
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setErr(null);
    setBusy(true);

    try {
      // Pass the explicit next through verbatim, or omit it entirely so
      // /auth/redirect resolves its own role-aware default once the OAuth
      // round trip completes and the signed-in user's role is known — role
      // can't be resolved here, before the user has even authenticated.
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const redirectTo = explicitNext
        ? `${siteUrl}/auth/redirect?next=${encodeURIComponent(explicitNext)}`
        : `${siteUrl}/auth/redirect`;

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
                <label className="text-sm text-muted-foreground">I am a</label>
                <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRequestedRole(opt.value)}
                      aria-pressed={requestedRole === opt.value}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        requestedRole === opt.value
                          ? "border-[color:var(--primary)] bg-[color:var(--primary)]/5 font-medium text-foreground"
                          : "border-input text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  New accounts require administrator approval before sign-in.
                </p>
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
        We keep sign-up simple: email, password, and your requested account type.
      </p>
    </div>
  );
}