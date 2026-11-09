"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useVisitedSystems } from "@/lib/visited";

export interface LearningPath {
  title: string;
  level: string;
  /** Category whose hue tints the path header. */
  hue: string;
  systems: { slug: string; name: string }[];
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 15;
  const circumference = 2 * Math.PI * r;
  const offset = Math.round(circumference * (1 - done / total) * 100) / 100;
  return (
    <svg
      viewBox="0 0 36 36"
      className="h-10 w-10 -rotate-90"
      role="img"
      aria-label={`${done} de ${total} visitados`}
    >
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="var(--cat)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={Math.round(circumference * 100) / 100}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}

export default function LearningPaths({ paths }: { paths: LearningPath[] }) {
  const visited = useVisitedSystems();

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {paths.map((path) => {
        const done = path.systems.filter((s) => visited.includes(s.slug)).length;
        return (
          <article
            key={path.title}
            data-category={path.hue}
            className="overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-200 hover:-translate-y-1 hover:shadow-glow"
          >
            <header className="flex items-center justify-between gap-3 bg-gradient-to-br from-cat-tint to-transparent px-5 pb-3 pt-5">
              <div>
                <p className="text-xs font-semibold text-cat">{path.level}</p>
                <h3 className="mt-1 font-semibold text-fg">{path.title}</h3>
              </div>
              <ProgressRing done={done} total={path.systems.length} />
            </header>
            <ol className="space-y-2 px-5 pb-5 pt-2">
              {path.systems.map((s, i) => {
                const seen = visited.includes(s.slug);
                return (
                  <li key={s.slug}>
                    <Link href={`/systems/${s.slug}`} className="group flex items-center gap-3 text-sm">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                          seen
                            ? "bg-cat text-bg"
                            : "bg-surface-2 text-muted group-hover:bg-cat-tint group-hover:text-fg"
                        }`}
                      >
                        {seen ? <Check size={13} aria-label="Visitado" /> : i + 1}
                      </span>
                      <span className="text-fg-soft group-hover:text-fg">{s.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </article>
        );
      })}
    </div>
  );
}
