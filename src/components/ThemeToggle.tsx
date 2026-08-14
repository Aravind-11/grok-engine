"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("light");
    document.documentElement.classList.toggle("light", next);
    localStorage.setItem("ge-theme", next ? "light" : "dark");
    setLight(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
      className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
    >
      {light ? "Dark" : "Light"}
    </button>
  );
}
