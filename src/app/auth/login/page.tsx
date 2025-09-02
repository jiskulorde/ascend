"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const supabase = browserSupabase();

async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  const emailNormalized = email.trim().toLowerCase();
  const { error } = await supabase.auth.signInWithPassword({
    email: emailNormalized,
    password,
  });
  if (error) { alert(error.message); return; }
  startTransition(() => router.push(next));
}

async function onSignUp() {
  const emailNormalized = email.trim().toLowerCase();
  const { error } = await supabase.auth.signUp({
    email: emailNormalized,
    password,
  });
  if (error) { alert(error.message); return; }
  alert("Sign-up successful. If confirmation is required, check your email, then sign in.");
}


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next);
    });
  }, [next, router, supabase]);

  return (
  <main className="min-h-dvh grid place-items-center p-6 bg-background">
    <div className="absolute inset-0 brand-hero pointer-events-none" />

    <section className="w-full max-w-md">
      <div className="card p-6 md:p-8 relative">
        <div className="absolute -top-6 left-6 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-4 py-2 text-xs shadow">
          Ascend • DMCI
        </div>

        <header className="mb-6 text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold">Welcome back</h1>
          <p className="muted">Sign in to access your dashboard</p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm muted">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm muted">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </label>

          <button type="submit" disabled={pending} className="btn btn-primary btn-block">
            {pending ? "Signing in..." : "Sign in"}
          </button>

          <button type="button" onClick={onSignUp} className="btn btn-outline btn-block">
            Create account
          </button>
        </form>

        <footer className="mt-6 text-center text-sm muted">
          By continuing you agree to our Terms & Privacy.
        </footer>
      </div>
    </section>
  </main>
);

}
