"use client";
import { useEffect, useState } from "react";

export default function PreviewSwitch({ show }: { show: boolean }) {
  const [mode, setMode] = useState<"client" | "staff">("client");

  useEffect(() => {
    const m =
      document.cookie
        .split("; ")
        .find((x) => x.startsWith("preview_mode="))
        ?.split("=")[1] || "client";
    setMode(m === "staff" ? "staff" : "client");
  }, []);

  if (!show) return null;

  const toggle = async () => {
    const next = mode === "client" ? "staff" : "client";
    await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
    setMode(next);
    window.location.reload();
  };

  return (
    <button className="btn btn-outline" onClick={toggle} title="Toggle homepage preview">
      {mode === "client" ? "Preview: Client" : "Preview: Staff"}
    </button>
  );
}
