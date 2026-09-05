"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { usePreferences, type ThemeMode } from "@/lib/store/preferences";
import { useThemeSync } from "@/lib/hooks";
import { Segmented } from "@/components/ui/primitives";

/**
 * Set data-theme before first paint.
 *
 * Without this the page renders in the default dark palette and then snaps to
 * light once the persisted store rehydrates — a visible flash on every load
 * for anyone using the light theme.
 */
export function ThemeScript() {
  const script = `
(function () {
  try {
    var raw = localStorage.getItem('forge.preferences');
    var mode = raw ? (JSON.parse(raw).state || {}).theme : null;
    if (mode !== 'light' && mode !== 'dark') {
      mode = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', mode);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function ThemeSync() {
  useThemeSync();
  return null;
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = usePreferences((s) => s.theme);
  const set = usePreferences((s) => s.set);

  return (
    <Segmented<ThemeMode>
      className={className}
      size="xs"
      value={theme}
      onChange={(next) => set("theme", next)}
      options={[
        { value: "light", label: <Sun className="size-3.5" />, title: "Light theme" },
        { value: "dark", label: <Moon className="size-3.5" />, title: "Dark theme" },
        { value: "system", label: <Monitor className="size-3.5" />, title: "Match system" },
      ]}
    />
  );
}
