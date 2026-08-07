"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // Reads the attribute set by the inline script in layout.tsx before
    // paint, so the toggle's label matches what's actually on screen.
    const current = document.documentElement.getAttribute("data-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("lowfreq-theme", next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="font-mono text-xs text-kraft border border-line rounded-full px-3 py-1.5 hover:border-kraft transition-colors"
    >
      {theme === "dark" ? "dark" : "light"} mode
    </button>
  );
}
