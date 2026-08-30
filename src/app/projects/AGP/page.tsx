// src/app/projects/AGP/page.tsx

import { serverSupabase } from "@/lib/supabase/server";
import AGPPageClient from "@/components/projects/AGPPageClient";

export const dynamic = "force-dynamic";

// Projects stay public — this page never redirects or denies access. The
// only thing session state changes is which inventory source the "lowest
// price by type" table reads from: the capped public preview endpoint for
// anonymous visitors, or the full authenticated endpoint (unchanged
// behavior) for anyone signed in. See AGPPageClient for the branch.
export default async function AGPPage() {
  const supabase = await serverSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <AGPPageClient isAuthenticated={!!user} />;
}
