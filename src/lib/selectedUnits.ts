// lib/selectedUnits.ts
export const STORAGE_KEY = "selectedUnits";

export function getSelectedUnits(): string[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveSelectedUnits(units: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(units));
}
