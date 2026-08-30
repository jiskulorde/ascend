// src/app/properties/page.tsx

import { redirect } from "next/navigation";

// /properties was an older, unguarded duplicate of /availability: a full
// seller-grade inventory browser (no pagination cap, no auth, every filter)
// that also fed selected units straight into /compare and /computation via
// localStorage — i.e. a second, un-capped public inventory surface with no
// distinct purpose of its own. Rather than maintain (or auth-gate) a second
// full-search experience, every visitor is sent to /availability, which
// already serves the right experience for both anonymous (capped preview)
// and authenticated (full) users. The original implementation is preserved
// in git history (this file was tracked before this change) and was never
// linked from primary navigation.
export default function PropertiesPage() {
  redirect("/availability");
}
