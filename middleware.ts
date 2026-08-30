// src/middleware.ts

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type Role = "CLIENT" | "AGENT" | "MANAGER" | "ADMIN";

const guards: Array<{
  prefix: string;
  allow: Role[];
}> = [
  { prefix: "/agent", allow: ["AGENT", "MANAGER", "ADMIN"] },
  { prefix: "/manager", allow: ["MANAGER", "ADMIN"] },
  { prefix: "/dashboard", allow: ["CLIENT", "AGENT", "MANAGER", "ADMIN"] },

  // /availability is NOT guarded here on purpose: anonymous visitors must
  // reach it to see the public preview (see src/app/availability/page.tsx,
  // which branches internally between the preview and full experience).
  // The full dataset itself is protected at the API layer instead —
  // GET /api/availability requires a session; GET /api/availability/preview
  // is the public, row-capped endpoint the preview UI calls.

  // Summary, Compare, and Computation have no public mode — every role
  // (including CLIENT) requires a session, matching each page's own
  // server-side guard. Kept here too for defense-in-depth.
  { prefix: "/summary", allow: ["CLIENT", "AGENT", "MANAGER", "ADMIN"] },
  { prefix: "/compare", allow: ["CLIENT", "AGENT", "MANAGER", "ADMIN"] },
  { prefix: "/computation", allow: ["CLIENT", "AGENT", "MANAGER", "ADMIN"] },
];

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/auth/login";
  url.search = "";
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

function redirectTo403(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/403";
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
    return redirectTo403(req);
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