// src/app/api/shortlists/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actionSupabase } from "@/lib/supabase/server";
import { requireSellerSession } from "@/lib/shortlists/authz";
import { serverError } from "@/lib/shortlists/errors";

const createShortlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required.")
    .max(120, "Name must be 120 characters or fewer."),
  notes: z.string().trim().optional().nullable(),
});

// GET /api/shortlists — the caller's own shortlists only (AGENT/MANAGER/ADMIN).
export async function GET() {
  const supabase = await actionSupabase();
  const authz = await requireSellerSession(supabase);
  if (!authz.ok) return authz.response;

  const { data, error } = await supabase
    .from("client_shortlists")
    .select("*")
    .eq("owner_id", authz.userId)
    // Secondary key so rows with an identical updated_at (e.g. bulk-created
    // in the same instant) still sort deterministically, not by row-fetch order.
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    return serverError("GET /api/shortlists", error);
  }

  return NextResponse.json({ shortlists: data ?? [] });
}

// POST /api/shortlists — create a shortlist owned by the caller.
export async function POST(req: NextRequest) {
  const supabase = await actionSupabase();
  const authz = await requireSellerSession(supabase);
  if (!authz.ok) return authz.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createShortlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const trimmedNotes = parsed.data.notes?.trim();

  // owner_id always comes from the authenticated session, never from the request body.
  const { data, error } = await supabase
    .from("client_shortlists")
    .insert({
      owner_id: authz.userId,
      name: parsed.data.name,
      notes: trimmedNotes ? trimmedNotes : null,
    })
    .select("*")
    .single();

  if (error) {
    return serverError("POST /api/shortlists insert", error);
  }

  return NextResponse.json({ shortlist: data }, { status: 201 });
}
