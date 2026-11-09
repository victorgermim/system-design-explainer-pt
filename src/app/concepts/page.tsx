import type { Metadata } from "next";
import Link from "next/link";
import { conceptFamilies } from "@/types/schema";
import { conceptFamilyLabels, concepts, systemsUsingConcept } from "@/content";
import { FamilyIcon } from "@/lib/identity";

export const metadata: Metadata = {
  title: "Conceitos · System Design Explainer",
  description: "As ideias recorrentes por trás de grandes sistemas: cache, sharding, fan-out, idempotência, sagas e mais.",
};

export default function ConceptsPage() {
  const groups = conceptFamilies
    .map((family) => ({ family, items: concepts.filter((c) => c.family === family) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">Conceitos</h1>
      <p className="mt-2 max-w-2xl text-muted">
        As mesmas poucas ideias aparecem repetidamente nos designs. Cada página explica uma delas com um
        diagrama que você pode percorrer passo a passo — e links para os sistemas que dependem dela.
      </p>

      <nav aria-label="Famílias de conceitos" className="mt-6 flex flex-wrap gap-2">
        {groups.map(({ family, items }) => (
          <a
            key={family}
            href={`#${family}`}
            data-family={family}
            className="flex items-center gap-2 rounded-full bg-cat-tint px-3 py-1.5 text-sm font-medium text-fg transition-opacity hover:opacity-80"
          >
            <span className="text-cat">
              <FamilyIcon family={family} size={14} />
            </span>
            {conceptFamilyLabels[family]}
            <span className="text-muted">{items.length}</span>
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-12">
        {groups.map(({ family, items }) => (
          <section key={family} id={family} data-family={family} className="scroll-mt-6">
            <h2 className="flex items-center gap-2.5 text-xl font-semibold text-fg">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cat-tint text-cat">
                <FamilyIcon family={family} size={16} />
              </span>
              {conceptFamilyLabels[family]}
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((concept) => {
                const usedIn = systemsUsingConcept(concept.slug);
                return (
                  <li key={concept.slug}>
                    <Link
                      href={`/concepts/${concept.slug}`}
                      className="flex h-full flex-col rounded-2xl border border-line border-t-[3px] border-t-cat bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-glow"
                    >
                      <p className="font-semibold text-fg">{concept.name}</p>
                      <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{concept.summary}</p>
                      <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                        {concept.visual && (
                          <span className="rounded-full bg-cat-tint px-2 py-0.5 font-medium text-fg">Interativo</span>
                        )}
                        <span className="truncate">
                          {usedIn.length > 0 ? `Visto em ${usedIn.map((s) => s.name).join(", ")}` : "Referência"}
                        </span>
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
