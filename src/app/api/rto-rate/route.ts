import { NextResponse, NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

/**
 * GET /api/rto-rate?project_code=AGP&unit_type=2BR&area=57
 * Returns: { eligible:boolean, monthly_rate?:number, memo_ref?:string, match?:{area_min:number|null, area_max:number|null} }
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const project_code = (url.searchParams.get("project_code") || "").trim().toUpperCase();
  const unit_type = (url.searchParams.get("unit_type") || "").trim().toUpperCase();
  const areaParam = url.searchParams.get("area");
  const area = areaParam ? Number(areaParam) : NaN;

  if (!project_code || !unit_type || !Number.isFinite(area)) {
    return NextResponse.json(
      { error: "Missing or invalid query: project_code, unit_type, area (sqm) are required" },
      { status: 400 }
    );
  }

  const supabase = await serverSupabase();

  // pull all active rows for that project/type
  const { data, error } = await supabase
    .from("rto_rates")
    .select("area_min, area_max, monthly_rate, memo_ref")
    .eq("project_code", project_code)
    .eq("unit_type", unit_type)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ eligible: false });
  }

  // choose the best matching row for this area
  type Row = { area_min: number | null; area_max: number | null; monthly_rate: number; memo_ref: string | null };
  const candidates = (data as Row[]).filter((r) => {
    const minOK = r.area_min == null || area >= r.area_min;
    const maxOK = r.area_max == null || area <= r.area_max;
    return minOK && maxOK;
  });

  if (candidates.length === 0) {
    return NextResponse.json({ eligible: false });
  }

  // prefer the *narrowest* range (most specific)
  const best = candidates
    .map((r) => ({
      ...r,
      span:
        (r.area_min == null || r.area_max == null)
          ? Number.POSITIVE_INFINITY
          : Math.abs((r.area_max as number) - (r.area_min as number)),
    }))
    .sort((a, b) => a.span - b.span)[0];

  return NextResponse.json({
    eligible: true,
    project_code,
    unit_type,
    area,
    monthly_rate: best.monthly_rate,
    memo_ref: best.memo_ref,
    match: { area_min: best.area_min, area_max: best.area_max },
  });
}
