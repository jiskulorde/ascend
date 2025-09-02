export default function Forbidden() {
  return (
    <main className="min-h-dvh grid place-items-center p-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-semibold">403 — Forbidden</h1>
        <p className="muted">You don’t have access to this area.</p>
        <a className="btn btn-primary mt-2" href="/dashboard">Go to Dashboard</a>
      </div>
    </main>
  );
}
