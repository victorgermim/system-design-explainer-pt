"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import ArchitectureNode from "./ArchitectureNode";
import TierNode from "./TierNode";
import PacketEdge from "./PacketEdge";
import type { Provider, SystemDesign } from "@/types/schema";
import { edgeStyles, systemToFlow, type FlowHighlight } from "@/lib/transformDiagram";
import { layoutSystem, type SystemLayout } from "@/lib/layout";

const nodeTypes = { architecture: ArchitectureNode, tier: TierNode };
const edgeTypes = { packet: PacketEdge };

interface ArchitectureDiagramProps {
  system: SystemDesign;
  provider: Provider;
  selectedNodeId: string | null;
  flowHighlight?: FlowHighlight | null;
  onNodeSelect: (nodeId: string | null) => void;
  /** View-only preview (landing page): no pan/zoom/selection, no controls or legend. */
  staticView?: boolean;
}

export default function ArchitectureDiagram({
  system,
  provider,
  selectedNodeId,
  flowHighlight = null,
  onNodeSelect,
  staticView = false,
}: ArchitectureDiagramProps) {
  const [computed, setComputed] = useState<{
    slug: string;
    layout: SystemLayout;
  } | null>(null);

  useEffect(() => {
    let active = true;
    layoutSystem(system).then((layout) => {
      if (active) setComputed({ slug: system.slug, layout });
    });
    return () => {
      active = false;
    };
  }, [system]);

  const layout = computed?.slug === system.slug ? computed.layout : null;

  const graph = useMemo(
    () => (layout ? systemToFlow(system, provider, layout, selectedNodeId, flowHighlight) : null),
    [system, provider, layout, selectedNodeId, flowHighlight],
  );

  const protocols = useMemo(
    () => [
      ...new Set(system.edges.map((e) => (!e.protocol || e.protocol === "https" ? "default" : e.protocol))),
    ],
    [system],
  );

  return (
    <div className="relative h-full w-full rounded-xl border border-line bg-bg">
      {graph ? (
        // Remount per system so fitView frames each new diagram.
        <FlowCanvas
          key={system.slug}
          nodes={graph.nodes}
          edges={graph.edges}
          protocols={protocols}
          onNodeSelect={onNodeSelect}
          staticView={staticView}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8" role="status">
          <span className="sr-only">Organizando o diagrama…</span>
          {[3, 4, 2].map((count, row) => (
            <div key={row} className="flex gap-4" aria-hidden>
              {Array.from({ length: count }, (_, i) => (
                <div key={i} className="skeleton h-12 w-28 animate-shimmer rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  protocols: (keyof typeof edgeStyles)[];
  onNodeSelect: (nodeId: string | null) => void;
  staticView: boolean;
}

function FlowCanvas({
  nodes: nextNodes,
  edges: nextEdges,
  protocols,
  onNodeSelect,
  staticView,
}: FlowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(nextNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(nextEdges);

  useEffect(() => {
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [nextNodes, nextEdges, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => node.type === "architecture" && onNodeSelect(node.id)}
      onPaneClick={() => onNodeSelect(null)}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={!staticView}
      panOnDrag={!staticView}
      zoomOnScroll={!staticView}
      zoomOnPinch={!staticView}
      zoomOnDoubleClick={!staticView}
      preventScrolling={!staticView}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      minZoom={0.2}
      maxZoom={1.75}
      proOptions={{ hideAttribution: true }}
      className="architecture-flow"
    >
      <Background gap={20} size={1} color="var(--line)" />
      {!staticView && (
        <Controls
          showInteractive={false}
          className="shadow-soft overflow-hidden !rounded-lg !border !border-line !bg-surface [&>button]:!border-line [&>button]:!bg-surface [&>button]:!text-fg-soft [&>button:hover]:!bg-surface-2"
        />
      )}
      {!staticView && (
        <Panel position="top-right">
          <ul className="shadow-soft space-y-1 rounded-lg border border-line bg-surface/90 px-3 py-2 backdrop-blur">
            {protocols.map((p) => {
              const style = edgeStyles[p];
              return (
                <li key={p} className="flex items-center gap-2 text-[11px] text-muted">
                  <svg width="28" height="6" aria-hidden>
                    <line
                      x1="0"
                      y1="3"
                      x2="28"
                      y2="3"
                      stroke={style.color}
                      strokeWidth="2"
                      strokeDasharray={style.dash}
                    />
                  </svg>
                  {style.label}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </ReactFlow>
  );
}
