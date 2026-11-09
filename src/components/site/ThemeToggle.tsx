"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSlidingIndicator } from "@/lib/useSlidingIndicator";
import { applyThemeMode, readThemeMode, subscribeTheme, type ThemeMode } from "@/lib/theme";

const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Claro", icon: Sun },
  { mode: "dark", label: "Escuro", icon: Moon },
  { mode: "system", label: "Sistema", icon: Monitor },
];

/** `compact` shows icons only (for the top bar); labels stay available to screen readers. */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const mode = useSyncExternalStore(subscribeTheme, readThemeMode, () => "system" as ThemeMode);
  const { ref, box } = useSlidingIndicator<HTMLDivElement>(options.findIndex((o) => o.mode === mode));

  return (
    <div ref={ref} role="radiogroup" aria-label="Tema" className="relative flex rounded-lg border border-line bg-surface p-0.5">
      {box && (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-md bg-surface-2 transition-all duration-300 ease-out"
          style={{ left: box.left, width: box.width }}
        />
      )}
      {options.map(({ mode: value, label, icon: Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            data-seg
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => applyThemeMode(value)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
              compact ? "px-1.5" : "px-2"
            } ${active ? `text-fg ${box ? "" : "bg-surface-2"}` : "text-muted hover:text-fg-soft"}`}
          >
            <Icon size={14} aria-hidden />
            {!compact && label}
          </button>
        );
      })}
    </div>
  );
}
