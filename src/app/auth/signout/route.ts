import { NextResponse } from "next/server";
import { actionSupabase } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await actionSupabase();
  await supabase.auth.signOut();

  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return NextResponse.redirect(new URL("/", url));
}
