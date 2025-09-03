// Supports both canonical "AGP__AGP-00A__C-Amina_1204" and a few legacy forms
export function makeUnitId(u: {
  property_code?: string;
  tower_code?: string;
  building_unit?: string;
}) {
  const p = (u.property_code || "").trim();
  const t = (u.tower_code || "").trim();
  const b = (u.building_unit || "").trim().replace(/\s+/g, "_");
  return [p, t, b].filter(Boolean).join("__");
}

export function matchesLegacyOrCanonical(
  u: { property_code?: string; tower_code?: string; building_unit?: string },
  candidate: string
) {
  if (!candidate) return false;

  // canonical
  const canonical = makeUnitId(u);
  if (canonical && candidate === canonical) return true;

  // legacy examples:
  // "AGP-C-Amina 1204" or "AGP-C-Amina_1204" or "AGP-C-Amina-1204"
  const normB = (u.building_unit || "").replace(/\s+/g, "_");
  const legacyA = `${u.property_code}-${normB}`;
  if (legacyA === candidate) return true;

  // fallback: case-insensitive compare of building unit only (rare)
  const cLower = candidate.toLowerCase();
  if (cLower.includes(normB.toLowerCase())) return true;

  return false;
}
