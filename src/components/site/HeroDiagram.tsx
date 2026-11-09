"use client";

import { useEffect, useMemo, useState } from "react";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";
import type { Provider, SystemDesign } from "@/types/schema";
import type { FlowHighlight } from "@/lib/transformDiagram";

const cycle: { id: Provider; label: string }[] = [
  { id: "generic", label: "Genérico" },
  { id: "aws", label: "AWS" },
  { id: "gcp", label: "Google Cloud" },
  { id: "azure", label: "Azure" },
  { id: "oss", label: "Código aberto" },
];
const TICK_MS = 2200;

/** Landing-page preview: a real diagram that cycles clouds while a walkthrough plays. */
export default function HeroDiagram({ system }: { system: SystemDesign }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const provider = cycle[Math.floor(tick / 2) % cycle.length];
  const flow = system.flows[0];
  const step = flow ? tick % flow.steps.length : 0;

  const highlight = useMemo<FlowHighlight | null>(
    () =>
      flow
        ? {
            activeEdgeId: flow.steps[step].edge,
            visitedEdgeIds: new Set(flow.steps.slice(0, step).map((s) => s.edge)),
          }
        : null,
    [flow, step],
  );

  return (
    <div className="shadow-soft relative h-[360px] overflow-hidden rounded-2xl border border-line bg-surface md:h-[440px]">
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-line bg-surface/90 px-3 py-1 text-xs backdrop-blur">
        <span className="h-2 w-2 rounded-full" style={{ background: `var(--provider-${provider.id})` }} aria-hidden />
        <span className="font-medium text-fg">{system.name}</span>
        <span className="text-muted">em {provider.label}</span>
      </div>
      <ArchitectureDiagram
        system={system}
        provider={provider.id}
        selectedNodeId={null}
        flowHighlight={highlight}
        onNodeSelect={() => {}}
        staticView
      />
      {flow && (
        <p className="absolute inset-x-3 bottom-3 z-10 truncate rounded-lg border border-line bg-surface/90 px-3 py-2 text-xs text-fg-soft backdrop-blur" aria-live="off">
          <span className="mr-1.5 font-semibold text-amber-300">
            {flow.name} · {step + 1}/{flow.steps.length}
          </span>
          {flow.steps[step].text}
        </p>
      )}
    </div>
  );
}
