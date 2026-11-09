"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from "lucide-react";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";
import CloudProviderSelector from "@/components/CloudProviderSelector";
import NodeDetailPanel from "@/components/NodeDetailPanel";
import { providerSchema, type Provider, type SystemDesign } from "@/types/schema";
import type { FlowHighlight } from "@/lib/transformDiagram";
import { PLAY_FLOW_EVENT, updateSearchParams } from "@/lib/url";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useSlidingIndicator } from "@/lib/useSlidingIndicator";
import TierList from "./TierList";

const STEP_INTERVAL_MS = 2600;

export default function ArchitectureSection({ system }: { system: SystemDesign }) {
  const searchParams = useSearchParams();

  const parsedProvider = providerSchema.safeParse(searchParams.get("cloud"));
  const provider: Provider = parsedProvider.success ? parsedProvider.data : "generic";

  const requestedNode = searchParams.get("node");
  const selectedNodeId = system.nodes.some((n) => n.id === requestedNode) ? requestedNode : null;

  const activeFlow = system.flows.find((f) => f.id === searchParams.get("flow")) ?? null;
  const requestedStep = Number.parseInt(searchParams.get("step") ?? "0", 10);
  const step = activeFlow
    ? Math.min(Math.max(Number.isNaN(requestedStep) ? 0 : requestedStep, 0), activeFlow.steps.length - 1)
    : 0;

  const [playing, setPlaying] = useState(false);
  const { ref: modeRef, box: modeBox } = useSlidingIndicator<HTMLDivElement>(activeFlow ? 1 : 0);

  // Phones get a tiered list by default; a pan-and-zoom canvas is awkward on small screens.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  // Wide screens: the diagram fills the workspace column and details open in the side panel.
  const isWide = useMediaQuery("(min-width: 1024px)");
  const [preferDiagram, setPreferDiagram] = useState(false);
  const showDiagram = isDesktop || preferDiagram;

  const flowHighlight = useMemo<FlowHighlight | null>(() => {
    if (!activeFlow) return null;
    return {
      activeEdgeId: activeFlow.steps[step].edge,
      visitedEdgeIds: new Set(activeFlow.steps.slice(0, step).map((s) => s.edge)),
    };
  }, [activeFlow, step]);

  const activeNodeIds = useMemo(() => {
    const edge = activeFlow && system.edges.find((e) => e.id === activeFlow.steps[step].edge);
    return new Set(edge ? [edge.from, edge.to] : []);
  }, [activeFlow, step, system.edges]);

  const goToStep = useCallback((next: number) => {
    updateSearchParams({ step: String(next) });
  }, []);

  const selectFlow = useCallback((flowId: string | null) => {
    setPlaying(flowId !== null);
    updateSearchParams({ flow: flowId, step: flowId ? "0" : null, node: null });
  }, []);

  useEffect(() => {
    const play = () => setPlaying(true);
    window.addEventListener(PLAY_FLOW_EVENT, play);
    return () => window.removeEventListener(PLAY_FLOW_EVENT, play);
  }, []);

  // Auto-advance while playing; stop on the last step.
  useEffect(() => {
    if (!playing || !activeFlow) return;
    if (step >= activeFlow.steps.length - 1) {
      const id = window.setTimeout(() => setPlaying(false), STEP_INTERVAL_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => goToStep(step + 1), STEP_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [playing, activeFlow, step, goToStep]);

  const handleNodeSelect = useCallback(
    (nodeId: string | null) => {
      if (nodeId) {
        setPlaying(false);
        updateSearchParams({ node: nodeId, flow: null, step: null });
      } else if (!activeFlow) {
        updateSearchParams({ node: null });
      }
    },
    [activeFlow],
  );

  return (
    <div className={isWide ? "flex h-full flex-col" : "mx-4 my-4 overflow-hidden rounded-2xl border border-line bg-bg md:mx-6"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5 md:px-6">
        {system.flows.length > 0 && (
          <div
            ref={modeRef}
            role="tablist"
            aria-label="Modo do diagrama"
            className="relative flex rounded-lg bg-surface-2 p-0.5"
          >
            {modeBox && (
              <span
                aria-hidden
                className="shadow-soft absolute top-0.5 bottom-0.5 rounded-md bg-surface transition-all duration-300 ease-out"
                style={{ left: modeBox.left, width: modeBox.width }}
              />
            )}
            {[
              { id: "architecture", label: "Arquitetura", active: !activeFlow, onClick: () => selectFlow(null) },
              {
                id: "walkthrough",
                label: "Passo a passo",
                active: Boolean(activeFlow),
                onClick: () => !activeFlow && selectFlow(system.flows[0].id),
              },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                data-seg
                role="tab"
                aria-selected={mode.active}
                onClick={mode.onClick}
                className={`relative rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  mode.active
                    ? `text-fg ${modeBox ? "" : "shadow-soft bg-surface"}`
                    : "text-muted hover:text-fg"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        )}
        {activeFlow && system.flows.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {system.flows.map((flow) => (
              <button
                key={flow.id}
                type="button"
                onClick={() => selectFlow(flow.id)}
                aria-pressed={activeFlow.id === flow.id}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeFlow.id === flow.id
                    ? "bg-amber-400 text-[#1c1917]"
                    : "border border-line text-muted hover:text-fg"
                }`}
              >
                {flow.name}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto">
          <CloudProviderSelector
            selected={provider}
            onChange={(next) => updateSearchParams({ cloud: next === "generic" ? null : next })}
          />
        </div>
      </div>

      {!isDesktop && (
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <span className="text-xs text-muted">Toque em um componente para ver os detalhes</span>
          <button
            type="button"
            onClick={() => setPreferDiagram(!preferDiagram)}
            className="rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-fg-soft hover:border-line-strong"
          >
            {preferDiagram ? "Mostrar como lista" : "Mostrar diagrama"}
          </button>
        </div>
      )}

      {/* The diagram gets the full width; details slide over it when a node is selected. */}
      <div
        className={`relative p-3 ${
          isWide ? "min-h-0 flex-1" : showDiagram ? "h-[min(78vh,820px)] min-h-[420px] md:min-h-[520px]" : ""
        }`}
      >
        {showDiagram ? (
          <ArchitectureDiagram
            system={system}
            provider={provider}
            selectedNodeId={selectedNodeId}
            flowHighlight={flowHighlight}
            onNodeSelect={handleNodeSelect}
          />
        ) : (
          <TierList
            system={system}
            provider={provider}
            selectedNodeId={selectedNodeId}
            activeNodeIds={activeNodeIds}
            onNodeSelect={handleNodeSelect}
          />
        )}
        {selectedNodeId && !isWide && (
          <div
            className={
              isDesktop
                ? "absolute inset-y-0 right-0 z-10 shadow-2xl shadow-black/60"
                : "fixed inset-0 z-40 bg-bg"
            }
          >
            <NodeDetailPanel
              nodeId={selectedNodeId}
              system={system}
              provider={provider}
              onClose={() => updateSearchParams({ node: null })}
            />
          </div>
        )}
      </div>

      {activeFlow && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex shrink-0 items-center gap-1">
            <IconButton label="Passo anterior" disabled={step === 0} onClick={() => goToStep(step - 1)}>
              <ChevronLeft size={16} />
            </IconButton>
            <IconButton
              label={playing ? "Pausar" : "Reproduzir"}
              onClick={() => {
                if (!playing && step === activeFlow.steps.length - 1) goToStep(0);
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </IconButton>
            <IconButton
              label="Próximo passo"
              disabled={step === activeFlow.steps.length - 1}
              onClick={() => goToStep(step + 1)}
            >
              <ChevronRight size={16} />
            </IconButton>
            <IconButton label="Reiniciar" onClick={() => goToStep(0)}>
              <RotateCcw size={14} />
            </IconButton>
          </div>
          <p className="min-w-0 flex-1 text-sm text-fg-soft" aria-live="polite">
            <span className="mr-2 font-semibold text-amber-300">
              {activeFlow.name} · {step + 1}/{activeFlow.steps.length}
            </span>
            {activeFlow.steps[step].text}
          </p>
          <IconButton label="Fechar passo a passo" onClick={() => selectFlow(null)}>
            <X size={16} />
          </IconButton>
        </div>
      )}
    </div>
  );
}

function IconButton({
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
