import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let mode: "client" | "staff" = "client";
  try {
    const body = await req.json();
    if (body?.mode === "staff") mode = "staff";
  } catch {}

  const res = NextResponse.json({ ok: true, mode });
  res.cookies.set("preview_mode", mode, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
