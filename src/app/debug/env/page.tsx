// Server component: safe to read process.env here
function mask(value?: string) {
  if (!value) return "undefined";
  if (value.length <= 8) return "***";
  return value.slice(0, 6) + "..." + value.slice(-6);
}

export default function EnvDebugPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <main style={{ padding: 16 }}>
      <h1>Env Debug</h1>
      <p><b>NEXT_PUBLIC_SUPABASE_URL</b>: {mask(url)}</p>
      <p><b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b>: {mask(anon)}</p>
      <p style={{ marginTop: 12, color: "#555" }}>
        Both should show masked values (not "undefined"). If either is "undefined", your
        <code> .env.local</code> isn’t being read or values are blank.
      </p>
    </main>
  );
}
