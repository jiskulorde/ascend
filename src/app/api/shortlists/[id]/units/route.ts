// src/app/api/shortlists/[id]/units/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { actionSupabase } from "@/lib/supabase/server";
import { requireSellerSession } from "@/lib/shortlists/authz";
import { isUuid } from "@/lib/shortlists/ids";
import { serverError } from "@/lib/shortlists/errors";

// saved_price/saved_status/saved_rto_eligible/saved_rto_rate are snapshots supplied
// by the caller from the already-loaded current unit — this route does not fetch or
// duplicate live inventory itself.
const addUnitSchema = z.object({
  unit_id: z.string().trim().min(1, "unit_id is required."),
  property_code: z.string().trim().min(1, "property_code is required."),
  tower_code: z.string().trim().min(1, "tower_code is required."),
  building_unit: z.string().trim().min(1, "building_unit is required."),
  saved_price: z.number().finite().nonnegative().optional().nullable(),
  saved_status: z.string().trim().min(1).optional().nullable(),
  saved_rto_eligible: z.boolean().optional().nullable(),
  saved_rto_rate: z.number().finite().nonnegative().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

// POST /api/shortlists/[id]/units — add one saved unit snapshot.
export async function POST(
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

  const { data: shortlist, error: shortlistError } = await supabase
    .from("client_shortlists")
    .select("id")
    .eq("id", id)
    .eq("owner_id", authz.userId)
    .maybeSingle();

  if (shortlistError) {
    return serverError("POST /api/shortlists/[id]/units ownership check", shortlistError);
  }
  if (!shortlist) {
    return NextResponse.json({ error: "Shortlist not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = addUnitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const trimmedNotes = parsed.data.notes?.trim();

  const { data, error } = await supabase
    .from("shortlist_units")
    .insert({
      shortlist_id: id,
      unit_id: parsed.data.unit_id,
      property_code: parsed.data.property_code,
      tower_code: parsed.data.tower_code,
      building_unit: parsed.data.building_unit,
      saved_price: parsed.data.saved_price ?? null,
      saved_status: parsed.data.saved_status ?? null,
      saved_rto_eligible: parsed.data.saved_rto_eligible ?? null,
      saved_rto_rate: parsed.data.saved_rto_rate ?? null,
      notes: trimmedNotes ? trimmedNotes : null,
    })
    .select("*")
    .single();

  if (error) {
    // Postgres unique_violation on (shortlist_id, property_code, tower_code, building_unit) —
    // the same physical unit was already saved to this shortlist under some unit_id format.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This unit is already saved to this shortlist." },
        { status: 409 }
      );
    }
    return serverError("POST /api/shortlists/[id]/units insert", error);
  }

  return NextResponse.json({ unit: data }, { status: 201 });
}
