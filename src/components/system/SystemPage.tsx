import { Suspense } from "react";
import Link from "next/link";
import { CircleCheck, Gauge, Sparkles, type LucideIcon } from "lucide-react";
import type { SystemDesign } from "@/types/schema";
import { difficultyLabels, getConcept, systemCategoryLabels } from "@/content";
import { SystemIcon } from "@/lib/identity";
import ArchitectureSection from "./ArchitectureSection";
import NodeSheet from "./NodeSheet";
import WorkspaceShell from "./WorkspaceShell";
import WorkspaceTabs, { type WorkspaceTab } from "./WorkspaceTabs";
import { NodeChip, PlayFlowButton } from "./JumpLinks";

const methodColors: Record<string, string> = {
  GET: "text-emerald-300 bg-emerald-500/10",
  POST: "text-sky-300 bg-sky-500/10",
  PUT: "text-amber-300 bg-amber-500/10",
  PATCH: "text-amber-300 bg-amber-500/10",
  DELETE: "text-rose-300 bg-rose-500/10",
  WS: "text-violet-300 bg-violet-500/10",
  GRPC: "text-cyan-300 bg-cyan-500/10",
};

/** Store families, matched on the first keyword in a data model's free-text store. */
const storeTypes: { match: RegExp; label: string; className: string }[] = [
  { match: /relational|relacional/i, label: "Relacional", className: "text-sky-300 bg-sky-500/10" },
  { match: /wide-column/i, label: "Wide-column", className: "text-violet-300 bg-violet-500/10" },
  { match: /key-value|document|chave-valor|documento/i, label: "Chave-valor", className: "text-amber-300 bg-amber-500/10" },
  { match: /in-memory|cache|em memória/i, label: "Em memória", className: "text-rose-300 bg-rose-500/10" },
  { match: /object storage|disk|armazenamento de objetos|disco/i, label: "Objeto", className: "text-emerald-300 bg-emerald-500/10" },
  { match: /search|busca/i, label: "Busca", className: "text-cyan-300 bg-cyan-500/10" },
  { match: /graph|grafo/i, label: "Grafo", className: "text-indigo-300 bg-indigo-500/10" },
];

function storeType(store: string) {
  const hits = storeTypes
    .map((t) => ({ t, at: store.search(t.match) }))
    .filter((h) => h.at >= 0)
    .sort((a, b) => a.at - b.at);
  return hits[0]?.t;
}

const difficultyDots = { 1: "bg-emerald-500", 2: "bg-amber-500", 3: "bg-rose-500" } as const;

/**
 * The system workspace: the architecture diagram on the left, and the write-up
 * (requirements, APIs, capacity, data, flows, reliability) in tabs on the right.
 */
export default function SystemPage({ system }: { system: SystemDesign }) {
  const tabs: WorkspaceTab[] = [
    { id: "overview", label: "Visão geral", content: <OverviewPanel system={system} />, show: true },
    { id: "apis", label: "APIs", content: <ApisPanel system={system} />, show: system.apis.length > 0 },
    {
      id: "capacity",
      label: "Capacidade",
      content: <CapacityPanel system={system} />,
      show: system.estimates.length > 0,
    },
    { id: "data", label: "Dados", content: <DataPanel system={system} />, show: system.dataModel.length > 0 },
    { id: "flows", label: "Fluxos", content: <FlowsPanel system={system} />, show: system.flows.length > 0 },
    {
      id: "reliability",
      label: "Confiabilidade",
      content: <ReliabilityPanel system={system} />,
      show: system.bottlenecks.length + system.scaling.length > 0,
    },
  ]
    .filter((t) => t.show)
    .map(({ id, label, content }) => ({ id, label, content }));

  return (
    <WorkspaceShell
      category={system.category}
      slug={system.slug}
      left={
        <>
          <div className="flex items-center gap-4 border-b border-line bg-gradient-to-r from-cat-tint via-cat-tint/40 to-transparent px-4 py-4 pr-14 md:px-6">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-cat shadow-soft sm:flex">
              <SystemIcon slug={system.slug} size={24} />
            </span>
            <div className="min-w-0">
              <nav aria-label="Caminho de navegação" className="flex items-center gap-1.5 text-xs text-muted">
                <Link href="/" className="hover:text-fg">
                  Sistemas
                </Link>
                <span aria-hidden>/</span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cat" aria-hidden />
                  {systemCategoryLabels[system.category]}
                </span>
                <span aria-hidden>·</span>
                <span className="flex items-center gap-1">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${difficultyDots[system.difficulty]}`}
                    aria-hidden
                  />
                  {difficultyLabels[system.difficulty]}
                </span>
              </nav>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg md:text-3xl">
                {system.name}
              </h1>
              <p className="mt-0.5 text-sm text-muted md:text-base">{system.tagline}</p>
            </div>
          </div>
          <div id="architecture" className="min-h-0 flex-1 scroll-mt-4">
            <Suspense fallback={<div className="h-[70vh] lg:h-full" />}>
              <ArchitectureSection system={system} />
            </Suspense>
          </div>
        </>
      }
      right={
        <>
          <WorkspaceTabs tabs={tabs} />
          <Suspense fallback={null}>
            <NodeSheet system={system} />
          </Suspense>
        </>
      }
    />
  );
}

/* Tab panels (server-rendered) ------------------------------------------------ */

function OverviewPanel({ system }: { system: SystemDesign }) {
  return (
    <div className="space-y-8">
      <p className="leading-relaxed text-fg-soft">{system.description}</p>

      {system.concepts.length > 0 && (
        <Block title="Conceitos">
          <div className="flex flex-wrap gap-1.5">
            {system.concepts.map((slug) => (
              <Link
                key={slug}
                href={`/concepts/${slug}`}
                className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent transition-opacity hover:opacity-80"
              >
                {getConcept(slug)?.name ?? slug}
              </Link>
            ))}
          </div>
        </Block>
      )}

      {system.requirements.functional.length > 0 && (
        <Block title="Requisitos funcionais">
          <BulletList
            items={system.requirements.functional}
            icon={CircleCheck}
            iconClassName="text-emerald-300"
          />
        </Block>
      )}
      {system.requirements.nonFunctional.length > 0 && (
        <Block title="Requisitos não funcionais">
          <BulletList items={system.requirements.nonFunctional} icon={Gauge} iconClassName="text-sky-300" />
        </Block>
      )}
      {system.extensions.length > 0 && (
        <Block title="Extensões">
          <BulletList items={system.extensions} icon={Sparkles} iconClassName="text-violet-300" />
        </Block>
      )}
    </div>
  );
}

function ApisPanel({ system }: { system: SystemDesign }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line text-sm">
      {system.apis.map((api) => (
        <li
          key={`${api.method} ${api.path}`}
          className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-2 gap-y-1 px-4 py-3"
        >
          <span className="self-start">
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${methodColors[api.method] ?? "text-fg-soft"}`}
            >
              {api.method}
            </span>
          </span>
          <span className="break-words font-mono text-[13px] text-fg">{api.path}</span>
          <span className="col-start-2 text-muted">{api.purpose}</span>
        </li>
      ))}
    </ul>
  );
}

function CapacityPanel({ system }: { system: SystemDesign }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {system.estimates.map((e) => (
        <div key={e.label} className="relative overflow-hidden rounded-xl border border-line p-4">
          <div className="bg-brand absolute inset-x-0 top-0 h-0.5 opacity-70" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wider text-muted">{e.label}</p>
          <p className="text-brand mt-1 inline-block text-2xl font-bold tracking-tight tabular-nums">
            {e.value}
          </p>
          {e.derivation && (
            <p className="mt-2 font-mono text-[12px] leading-relaxed text-muted">{e.derivation}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function DataPanel({ system }: { system: SystemDesign }) {
  return (
    <div className="space-y-3">
      {system.dataModel.map((d) => {
        const type = storeType(d.store);
        return (
          <article key={d.entity} className="rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-fg">{d.entity}</h3>
              <span className="flex items-center gap-2 text-xs text-muted">
                {type && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${type.className}`}>
                    {type.label}
                  </span>
                )}
                {d.store}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted">
              Chave <span className="ml-1 font-mono text-[12px] text-accent">{d.key}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {d.fields.map((f) => (
                <span
                  key={f}
                  className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-soft"
                >
                  {f}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm text-fg-soft">{d.why}</p>
          </article>
        );
      })}
    </div>
  );
}

function FlowsPanel({ system }: { system: SystemDesign }) {
  return (
    <div className="space-y-4">
      {system.flows.map((flow) => (
        <article key={flow.id} className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-fg">{flow.name}</h3>
            <PlayFlowButton flowId={flow.id} />
          </div>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-fg-soft marker:text-faint">
            {flow.steps.map((s) => (
              <li key={s.edge + s.text}>{s.text}</li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}

function ReliabilityPanel({ system }: { system: SystemDesign }) {
  const nodeLabel = (id: string) => system.nodes.find((n) => n.id === id)?.label ?? id;
  return (
    <div className="space-y-8">
      {system.bottlenecks.length > 0 && (
        <Block title="Gargalos e soluções">
          <div className="space-y-3">
            {system.bottlenecks.map((b) => (
              <article key={b.problem} className="rounded-xl border border-line p-4">
                <p className="font-medium text-fg">{b.problem}</p>
                <p className="mt-1.5 text-sm text-fg-soft">
                  <span className="font-semibold text-emerald-300">Solução · </span>
                  {b.fix}
                </p>
                {b.nodes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {b.nodes.map((id) => (
                      <NodeChip key={id} nodeId={id} label={nodeLabel(id)} />
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </Block>
      )}
      {system.scaling.length > 0 && (
        <Block title="Escalabilidade">
          <BulletList items={system.scaling} />
        </Block>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">{title}</h2>
      {children}
    </section>
  );
}

function BulletList({
  items,
  icon: Icon,
  iconClassName = "",
}: {
  items: string[];
  icon?: LucideIcon;
  iconClassName?: string;
}) {
  if (Icon) {
    return (
      <ul className="space-y-2 text-sm leading-relaxed text-fg-soft">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <Icon size={16} className={`mt-0.5 shrink-0 ${iconClassName}`} aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-fg-soft marker:text-faint">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
