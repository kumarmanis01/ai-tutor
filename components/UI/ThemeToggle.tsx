// components/UI/ThemeToggle.tsx
"use client";

import React, { useEffect, useState } from "react";

/**
 * ThemeToggle keeps UI concerns local.
 * It toggles a data-theme flag on <html> for CSS-based theming.
 * This is intentionally minimal: swap implementation with context/provider later.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("ai-tutor:dark");
      return v ? v === "1" : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("ai-tutor:dark", dark ? "1" : "0");
      if (dark) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    } catch {
      // ignore
    }
  }, [dark]);

  return (
    <button
      aria-pressed={dark}
      onClick={() => setDark((d) => !d)}
      className="p-2 rounded border"
      aria-label="Toggle theme"
    >
      {dark ? "🌙" : "☀️"}
    </button>
  );
}
