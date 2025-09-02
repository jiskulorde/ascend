import { serverSupabase } from "@/lib/supabase/server";

export default async function Dashboard() {
  const supabase = await serverSupabase();

  const { data: { session } } = await supabase.auth.getSession();

  // If not logged-in we’ll just show a friendly message (guards come in 3B)
  if (!session) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-slate-600">You’re not signed in. <a className="underline" href="/auth/login">Sign in</a></p>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", session.user.id)
    .single();

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-slate-600">
        Welcome {profile?.full_name || session.user.email} — role: <b>{profile?.role ?? "CLIENT"}</b>
      </p>

      <form action="/auth/signout" method="post">
        <button className="rounded-md border px-3 py-1">Sign out</button>
      </form>
    </main>
  );
}
