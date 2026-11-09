"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";
import type { SystemDesign } from "@/types/schema";
import type { FlowHighlight } from "@/lib/transformDiagram";

const STEP_INTERVAL_MS = 2600;

/** A concept's mini-architecture with its own step-through player (state is local, not in the URL). */
export default function ConceptFlow({ system }: { system: SystemDesign }) {
  const [flowIndex, setFlowIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const flow = system.flows[flowIndex] ?? null;
  const last = flow ? flow.steps.length - 1 : 0;

  useEffect(() => {
    if (!playing || !flow) return;
    const id = window.setTimeout(() => {
      if (step >= last) setPlaying(false);
      else setStep(step + 1);
    }, STEP_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [playing, flow, step, last]);

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

  const chooseFlow = (index: number) => {
    setFlowIndex(index);
    setStep(0);
    setPlaying(false);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {system.flows.length > 1 && (
        <div role="tablist" aria-label="Cenários" className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
          {system.flows.map((f, i) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={i === flowIndex}
              onClick={() => chooseFlow(i)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === flowIndex ? "bg-amber-400 text-[#1c1917]" : "border border-line text-muted hover:text-fg"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      <div className="h-[340px] p-2 md:h-[400px]">
        <ArchitectureDiagram
          system={system}
          provider="generic"
          selectedNodeId={null}
          flowHighlight={highlight}
          onNodeSelect={() => {}}
          staticView
        />
      </div>

      {flow && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <div className="flex items-center gap-0.5">
            <ControlButton label="Passo anterior" disabled={step === 0} onClick={() => setStep(step - 1)}>
              <ChevronLeft size={16} />
            </ControlButton>
            <ControlButton
              label={playing ? "Pausar" : "Reproduzir"}
              onClick={() => {
                if (!playing && step === last) setStep(0);
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </ControlButton>
            <ControlButton label="Próximo passo" disabled={step === last} onClick={() => setStep(step + 1)}>
              <ChevronRight size={16} />
            </ControlButton>
            <ControlButton label="Reiniciar" onClick={() => setStep(0)}>
              <RotateCcw size={14} />
            </ControlButton>
          </div>
          <p className="min-w-0 flex-1 text-sm text-fg-soft" aria-live="polite">
            <span className="mr-2 font-semibold text-amber-300">
              {step + 1}/{flow.steps.length}
            </span>
            {flow.steps[step].text}
          </p>
        </div>
      )}

      <dl className="grid gap-x-6 gap-y-2 border-t border-line px-4 py-3 text-sm sm:grid-cols-2">
        {system.nodes.map((n) => (
          <div key={n.id} className="flex gap-2">
            <dt className="shrink-0 font-medium text-fg">{n.label}</dt>
            <dd className="text-muted">— {n.role}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ControlButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg p-1.5 text-fg-soft transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
