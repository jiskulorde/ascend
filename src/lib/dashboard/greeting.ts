// src/lib/dashboard/greeting.ts

export function timeOfDayGreeting(date: Date): "Good morning" | "Good afternoon" | "Good evening" {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// "Juan Dela Cruz" -> "Juan"; falls back to the email's local part, then a
// generic-but-friendly default. Never renders an empty/undefined name.
export function firstNameOf(fullName: string | null | undefined, email: string | null | undefined): string {
  const trimmed = (fullName || "").trim();
  if (trimmed) return trimmed.split(/\s+/)[0];

  const emailLocal = (email || "").split("@")[0]?.trim();
  if (emailLocal) return emailLocal;

  return "there";
}
