"use client";

import EmptyIllustration from "./EmptyIllustration";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { SystemIcon } from "@/lib/identity";

export interface CatalogueCard {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  categoryLabel: string;
  difficulty: 1 | 2 | 3;
  difficultyLabel: string;
  componentCount: number;
  flowCount: number;
  complete: boolean;
  concepts: { slug: string; name: string }[];
}

const difficultyPill = {
  1: "bg-emerald-500/12 text-emerald-300",
  2: "bg-amber-500/12 text-amber-300",
  3: "bg-rose-500/12 text-rose-300",
} as const;

interface Option {
  value: string;
  label: string;
}

export default function SystemCatalogue({
  cards,
  categories,
  conceptOptions,
}: {
  cards: CatalogueCard[];
  categories: Option[];
  conceptOptions: Option[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [concept, setConcept] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter(
      (c) =>
        (!category || c.category === category) &&
        (!difficulty || c.difficulty === difficulty) &&
        (!concept || c.concepts.some((x) => x.slug === concept)) &&
        (!q || `${c.name} ${c.tagline}`.toLowerCase().includes(q)),
    );
  }, [cards, query, category, difficulty, concept]);

  const filtered = query || category || difficulty || concept;

  return (
    <>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3">
          <Search size={14} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar sistemas…"
            className="h-9 w-44 bg-transparent text-sm text-fg placeholder:text-muted focus:outline-none"
          />
        </label>

        <ChipGroup options={categories} value={category} onChange={setCategory} allLabel="Todas as categorias" categoryDots />
        <ChipGroup
          options={[
            { value: "1", label: "Iniciante" },
            { value: "2", label: "Intermediário" },
            { value: "3", label: "Avançado" },
          ]}
          value={difficulty ? String(difficulty) : null}
          onChange={(v) => setDifficulty(v ? Number(v) : null)}
          allLabel="Qualquer nível"
        />

        <select
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          aria-label="Filtrar por conceito"
          className="h-9 rounded-lg border border-line-strong bg-surface px-3 text-sm text-fg-soft focus:outline-none"
        >
          <option value="">Qualquer conceito</option>
          {conceptOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory(null);
              setDifficulty(null);
              setConcept("");
            }}
            className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        {visible.length} de {cards.length} sistemas
      </p>

      <ul className="mt-3 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((card) => (
          <li key={card.slug} data-category={card.category}>
            <Link
              href={`/systems/${card.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-200 hover:-translate-y-1 hover:border-line-strong hover:shadow-glow"
            >
              <div className="h-16 border-b border-line bg-cat-tint" aria-hidden>
                <div className="h-1 bg-cat" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cat-tint text-cat">
                    <SystemIcon slug={card.slug} size={19} />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-cat" aria-hidden />
                      {card.categoryLabel}
                    </p>
                    <p className="truncate text-lg font-semibold text-fg">{card.name}</p>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{card.tagline}</p>
                {card.concepts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {card.concepts.slice(0, 3).map((c) => (
                      <span key={c.slug} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-fg-soft">
                        {c.name}
                      </span>
                    ))}
                    {card.concepts.length > 3 && (
                      <span className="px-1 text-[11px] text-muted">+{card.concepts.length - 3}</span>
                    )}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${difficultyPill[card.difficulty]}`}>
                    {card.difficultyLabel}
                  </span>
                  <span className="text-muted">
                    {card.componentCount} componentes · {card.flowCount} fluxos passo a passo
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <EmptyIllustration />
          <p className="text-sm text-muted">Nenhum sistema corresponde a esses filtros.</p>
        </div>
      )}
    </>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
  allLabel,
  categoryDots = false,
}: {
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  allLabel: string;
  /** Prefix each option with its category colour dot (options' values are category ids). */
  categoryDots?: boolean;
}) {
  return (
    <div className="flex flex-wrap rounded-xl border border-line bg-surface p-1">
      {[{ value: null, label: allLabel }, ...options].map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          data-category={categoryDots && o.value ? o.value : undefined}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.value
              ? categoryDots && o.value
                ? "bg-cat-tint text-fg"
                : "bg-surface-2 text-fg"
              : "text-muted hover:text-fg"
          }`}
        >
          {categoryDots && o.value && <span className="h-2 w-2 rounded-full bg-cat" aria-hidden />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
