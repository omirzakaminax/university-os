"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { updatePreferencesAction } from "@/app/actions/data";
import { THEME_COOKIE, isThemeMode, type ThemeMode } from "@/domain/theme";
import { cn } from "@/lib/cn";

function readCookie(): ThemeMode {
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]+)`));
  const v = m ? decodeURIComponent(m[1]!) : "system";
  return isThemeMode(v) ? v : "system";
}

/** Apply a mode to <html> immediately and remember it in a cookie (read by the pre-paint script). */
export function applyTheme(mode: ThemeMode) {
  const resolved = mode === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
  document.documentElement.setAttribute("data-theme", resolved);
  document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Light / Dark / System. The choice is saved to the user's account (so it follows them across devices)
 * and mirrored to a cookie so the very first paint on this device is already correct.
 * `saved` is the account preference; if this device's cookie disagrees we adopt the account value.
 */
export function ThemeSwitcher({ saved, compact = false }: { saved: ThemeMode; compact?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>(saved);

  useEffect(() => {
    // Adopt the account preference on a device whose cookie is stale (e.g. first sign-in on a new browser).
    if (readCookie() !== saved) applyTheme(saved);
  }, [saved]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const choose = useCallback((next: ThemeMode) => {
    setMode(next);
    applyTheme(next);
    void updatePreferencesAction({ theme: next });
  }, []);

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          aria-label={`${o.label} theme`}
          title={`${o.label} theme`}
          onClick={() => choose(o.value)}
          className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors", mode === o.value ? "bg-raised text-fg shadow-sm" : "text-subtle hover:text-fg")}
        >
          <o.icon className="h-3.5 w-3.5" aria-hidden />
          {!compact && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}
