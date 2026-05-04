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

  // Your Availability page already allows CLIENT, AGENT, and MANAGER.
  // Keep this consistent with src/app/availability/page.tsx.
  { prefix: "/availability", allow: ["CLIENT", "AGENT", "MANAGER", "ADMIN"] },
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
    "/availability/:path*",
  ],
};