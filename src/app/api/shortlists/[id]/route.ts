// src/app/api/shortlists/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actionSupabase } from "@/lib/supabase/server";
import { requireSellerSession } from "@/lib/shortlists/authz";
import { isUuid } from "@/lib/shortlists/ids";
import { serverError } from "@/lib/shortlists/errors";

const updateShortlistSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required.")
      .max(120, "Name must be 120 characters or fewer.")
      .optional(),
    notes: z.string().trim().optional().nullable(),
  })
  .refine((v) => v.name !== undefined || v.notes !== undefined, {
    message: "At least one of name or notes must be provided.",
  });

// GET /api/shortlists/[id] — the owned shortlist plus its saved units.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await actionSupabase();
  const authz = await requireSellerSession(supabase);
  if (!authz.ok) return authz.response;

  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid shortlist id." }, { status: 400 });
  }

  const { data: shortlist, error: shortlistError } = await supabase
    .from("client_shortlists")
    .select("*")
    .eq("id", id)
    .eq("owner_id", authz.userId)
    .maybeSingle();

  if (shortlistError) {
    return serverError("GET /api/shortlists/[id] shortlist", shortlistError);
  }
  if (!shortlist) {
    return NextResponse.json({ error: "Shortlist not found." }, { status: 404 });
  }

  const { data: units, error: unitsError } = await supabase
    .from("shortlist_units")
    .select("*")
    .eq("shortlist_id", id)
    // Secondary key so rows with an identical saved_at still sort deterministically.
    .order("saved_at", { ascending: false })
    .order("id", { ascending: false });

  if (unitsError) {
    return serverError("GET /api/shortlists/[id] units", unitsError);
  }

  return NextResponse.json({ shortlist, units: units ?? [] });
}

// PATCH /api/shortlists/[id] — rename and/or update notes.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await actionSupabase();
  const authz = await requireSellerSession(supabase);
  if (!authz.ok) return authz.response;

  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid shortlist id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateShortlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const patch: { name?: string; notes?: string | null } = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.notes !== undefined) {
    const trimmed = parsed.data.notes?.trim();
    patch.notes = trimmed ? trimmed : null;
  }

  const { data, error } = await supabase
    .from("client_shortlists")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", authz.userId)
    .select("*")
    .maybeSingle();

  if (error) {
    return serverError("PATCH /api/shortlists/[id]", error);
  }
  if (!data) {
    return NextResponse.json({ error: "Shortlist not found." }, { status: 404 });
  }

  return NextResponse.json({ shortlist: data });
}

// DELETE /api/shortlists/[id] — cascades to shortlist_units via the DB FK.
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await actionSupabase();
  const authz = await requireSellerSession(supabase);
  if (!authz.ok) return authz.response;

  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid shortlist id." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("client_shortlists")
    .delete()
    .eq("id", id)
    .eq("owner_id", authz.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return serverError("DELETE /api/shortlists/[id]", error);
  }
  if (!data) {
    return NextResponse.json({ error: "Shortlist not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
