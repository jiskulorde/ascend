// src/app/auth/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

function LoginSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-28 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
            <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-10 w-full animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <div className="mt-5 h-10 w-full animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden">
        <div className="brand-hero absolute inset-0 opacity-15" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-6 py-10">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Welcome</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in or create an account to access availability and tools.
          </p>
          <div className="mt-6">
            <Suspense fallback={<LoginSkeleton />}>
              <LoginClient />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
