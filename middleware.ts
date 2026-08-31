// src/middleware.ts

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

const guards: Array<{
  prefix: string;
  allow: Role[];
  // Where an authenticated-but-wrong-role request gets sent. Defaults to
  // /403. Seller tools use "/" instead: CLIENT is a real, expected role for
  // these prefixes (not an error condition), so it gets a plain redirect
  // Home rather than a Forbidden page — see Phase 1 access matrix.
  deniedRedirect?: string;
}> = [
  { prefix: "/agent", allow: ["AGENT", "MANAGER", "ADMIN"] },
  { prefix: "/manager", allow: ["MANAGER", "ADMIN"] },

  // CLIENT is a buyer account with no seller dashboard — every /dashboard/*
  // route (including /dashboard/users, /dashboard/team, etc.) is seller/admin
  // only. CLIENT gets sent Home, not /403, matching the seller-tool prefixes
  // below rather than treating "CLIENT tried /dashboard" as an error state.
  { prefix: "/dashboard", allow: ["AGENT", "MANAGER", "ADMIN"], deniedRedirect: "/" },

  // /availability is NOT guarded here on purpose: anonymous visitors must
  // reach it to see the public preview (see src/app/availability/page.tsx,
  // which branches internally between the preview and full experience).
  // The full dataset itself is protected at the API layer instead —
  // GET /api/availability requires a session AND a seller role;
  // GET /api/availability/preview is the public, row-capped endpoint the
  // preview UI calls (CLIENT uses this same preview, not the full dataset).

  // Summary, Compare, and Computation are seller tools (AGENT/MANAGER/ADMIN)
  // — CLIENT is a buyer account and is redirected Home, matching /dashboard
  // above. Anonymous still hits the login redirect below (no session at all).
  { prefix: "/summary", allow: ["AGENT", "MANAGER", "ADMIN"], deniedRedirect: "/" },
  { prefix: "/compare", allow: ["AGENT", "MANAGER", "ADMIN"], deniedRedirect: "/" },
  { prefix: "/computation", allow: ["AGENT", "MANAGER", "ADMIN"], deniedRedirect: "/" },
];

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/auth/login";
  url.search = "";
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

function redirectToDenied(req: NextRequest, destination: string) {
  const url = req.nextUrl.clone();
  url.pathname = destination;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const guard = guards.find((g) => path.startsWith(g.prefix));

  if (!guard) {
    return NextResponse.next();
  }

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          });

          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToLogin(req);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role || "CLIENT") as Role;

  if (!guard.allow.includes(role)) {
    return redirectToDenied(req, guard.deniedRedirect ?? "/403");
  }

  return res;
}

export const config = {
  matcher: [
    "/agent/:path*",
    "/manager/:path*",
    "/dashboard/:path*",
    "/summary/:path*",
    "/compare/:path*",
    "/computation/:path*",
  ],
};