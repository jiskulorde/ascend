// src/app/api/shortlists/[id]/units/[shortlistUnitId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actionSupabase } from "@/lib/supabase/server";
import { requireSellerSession } from "@/lib/shortlists/authz";
import { isUuid } from "@/lib/shortlists/ids";
import { serverError } from "@/lib/shortlists/errors";

const updateUnitNotesSchema = z.object({
  notes: z.string().trim().nullable(),
});

// PATCH /api/shortlists/[id]/units/[shortlistUnitId] — notes only, for now.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; shortlistUnitId: string }> }
) {
  const { id, shortlistUnitId } = await context.params;
  const supabase = await actionSupabase();
  const authz = await requireSellerSession(supabase);
  if (!authz.ok) return authz.response;

  if (!isUuid(id) || !isUuid(shortlistUnitId)) {
    return NextResponse.json({ error: "Invalid shortlist or unit id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateUnitNotesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const trimmed = parsed.data.notes?.trim();

  // Ownership is enforced by RLS (shortlist_units policy joins to client_shortlists.owner_id);
  // scoping to both ids here also keeps the URL's shortlist id and unit id consistent with
  // each other, so a mismatched pair 404s instead of silently updating the wrong shortlist's unit.
  const { data, error } = await supabase
    .from("shortlist_units")
    .update({ notes: trimmed ? trimmed : null })
    .eq("id", shortlistUnitId)
    .eq("shortlist_id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return serverError("PATCH /api/shortlists/[id]/units/[shortlistUnitId]", error);
  }
  if (!data) {
    return NextResponse.json({ error: "Saved unit not found." }, { status: 404 });
  }

  return NextResponse.json({ unit: data });
}

// DELETE /api/shortlists/[id]/units/[shortlistUnitId] — remove one saved unit.
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; shortlistUnitId: string }> }
) {
  const { id, shortlistUnitId } = await context.params;
  const supabase = await actionSupabase();
  const authz = await requireSellerSession(supabase);
  if (!authz.ok) return authz.response;

  if (!isUuid(id) || !isUuid(shortlistUnitId)) {
    return NextResponse.json({ error: "Invalid shortlist or unit id." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shortlist_units")
    .delete()
    .eq("id", shortlistUnitId)
    .eq("shortlist_id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return serverError("DELETE /api/shortlists/[id]/units/[shortlistUnitId]", error);
  }
  if (!data) {
    return NextResponse.json({ error: "Saved unit not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
