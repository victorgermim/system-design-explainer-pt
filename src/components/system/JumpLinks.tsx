"use client";

import { Play } from "lucide-react";
import { PLAY_FLOW_EVENT, scrollToSection, updateSearchParams } from "@/lib/url";

/** Selects a node on the diagram and scrolls up to it. */
export function NodeChip({ nodeId, label }: { nodeId: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        updateSearchParams({ node: nodeId, flow: null, step: null }, { hash: "architecture" });
        scrollToSection("architecture");
      }}
      className="rounded-md border border-line-strong bg-surface px-2 py-0.5 text-xs text-fg-soft transition-colors hover:border-line-strong hover:text-fg"
    >
      {label}
    </button>
  );
}

/** Starts a flow walkthrough on the diagram and scrolls up to it. */
export function PlayFlowButton({ flowId }: { flowId: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        updateSearchParams({ flow: flowId, step: "0", node: null }, { hash: "architecture" });
        window.dispatchEvent(new Event(PLAY_FLOW_EVENT));
        scrollToSection("architecture");
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/25"
    >
      <Play size={12} /> Reproduzir no diagrama
    </button>
  );
}
