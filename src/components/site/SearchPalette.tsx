"use client";

import EmptyIllustration from "./EmptyIllustration";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchItems, type SearchItem } from "@/lib/search-match";

const typeColors: Record<SearchItem["type"], string> = {
  System: "text-indigo-300 bg-indigo-500/10",
  Component: "text-sky-300 bg-sky-500/10",
  Concept: "text-emerald-300 bg-emerald-500/10",
};

const typeLabels: Record<SearchItem["type"], string> = {
  System: "Sistema",
  Component: "Componente",
  Concept: "Conceito",
};

export default function SearchPalette({
  items,
  open,
  onClose,
}: {
  items: SearchItem[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchItems(items, query), [items, query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const close = () => {
    setQuery("");
    setActive(0);
    onClose();
  };

  const go = (item: SearchItem | undefined) => {
    if (!item) return;
    close();
    router.push(item.href);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-bg/70 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") go(results[active]);
            }}
            placeholder="Buscar sistemas, componentes, serviços, conceitos…"
            className="h-12 w-full bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
          />
          <kbd className="rounded border border-line-strong px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
        </div>

        {query && (
          <ul className="max-h-[50vh] overflow-y-auto py-2" role="listbox">
            {results.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted">
                <EmptyIllustration className="h-14 w-24" />
                Nenhum resultado para “{query}”
              </li>
            )}
            {results.map((item, i) => (
              <li key={item.href} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                  className={`flex w-full items-start gap-3 px-4 py-2.5 text-left ${i === active ? "bg-surface-2" : ""}`}
                >
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeColors[item.type]}`}
                  >
                    {typeLabels[item.type]}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{item.title}</span>
                    <span className="block truncate text-xs text-muted">{item.subtitle}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
