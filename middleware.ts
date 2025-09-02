import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

const guards = [
  { prefix: "/agent",   allow: ["AGENT", "MANAGER"] as const },
  { prefix: "/manager", allow: ["MANAGER"] as const },
  { prefix: "/dashboard", allow: ["CLIENT", "AGENT", "MANAGER"] as const }, // must be logged in
  { prefix: "/availability", allow: ["AGENT", "MANAGER"] as const }, 
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { session } } = await supabase.auth.getSession();
  const path = req.nextUrl.pathname;
  const guard = guards.find(g => path.startsWith(g.prefix));
  if (!guard) return res;

  // Require login
  if (!session) {
    const url = new URL("/auth/login", req.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!profile || !guard.allow.includes(profile.role as any)) {
    return NextResponse.redirect(new URL("/403", req.url));
  }

  return res;
}

// Which paths the middleware runs on
export const config = {
  matcher: ["/agent/:path*", "/manager/:path*", "/dashboard/:path*", "/availability/:path*"],
};
