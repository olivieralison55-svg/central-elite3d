"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // storage unavailable (private mode) — non-fatal, theme still applies
  }
}

/** Light/dark switch. Reads the class set by the no-flash script in layout. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-background text-muted transition-colors duration-quick ease-out-quart hover:bg-selected hover:text-ink"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
