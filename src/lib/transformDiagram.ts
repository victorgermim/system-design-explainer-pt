import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { ComponentCategory, Provider, SystemDesign, SystemEdge } from "@/types/schema";
import { getComponentKind } from "@/content";
import { resolveService } from "./resolve";
import type { SystemLayout } from "./layout";

export interface ArchitectureNodeData extends Record<string, unknown> {
  kindId: string;
  kindName: string;
  label: string;
  genericLabel: string;
  category: ComponentCategory | undefined;
  mapped: boolean;
  dimmed: boolean;
  /** An endpoint of the current walkthrough step. */
  inStep: boolean;
  /** Current provider, so nodes can flash when it changes. */
  provider: Provider;
}

export interface TierNodeData extends Record<string, unknown> {
  label: string;
  tier: string;
}

type Protocol = NonNullable<SystemEdge["protocol"]> | "default";

export const edgeStyles: Record<Protocol, { label: string; color: string; dash?: string; animated?: boolean }> = {
  default: { label: "Requisição (HTTPS)", color: "#64748b" },
  https: { label: "Requisição (HTTPS)", color: "#64748b" },
  grpc: { label: "RPC interno (gRPC)", color: "#0ea5e9" },
  ws: { label: "Conexão persistente (WebSocket)", color: "#22c55e" },
  async: { label: "Mensagem / job assíncrono", color: "#a855f7", dash: "6 4", animated: true },
  stream: { label: "Stream de eventos", color: "#14b8a6", dash: "6 4", animated: true },
  cdc: { label: "Change data capture", color: "#f97316", dash: "2 4" },
};

const FLOW_COLOR = "#f59e0b";

/** A request-flow walkthrough in progress: the current step's edge and the ones already shown. */
export interface FlowHighlight {
  activeEdgeId: string;
  visitedEdgeIds: Set<string>;
}

export function systemToFlow(
  system: SystemDesign,
  provider: Provider,
  layout: SystemLayout,
  selectedNodeId: string | null,
  flow: FlowHighlight | null = null,
): { nodes: Node[]; edges: Edge[] } {
  const flowNodeIds = new Set<string>();
  const stepNodeIds = new Set<string>();
  if (flow) {
    for (const edge of system.edges) {
      if (edge.id === flow.activeEdgeId) {
        stepNodeIds.add(edge.from);
        stepNodeIds.add(edge.to);
      }
      if (edge.id === flow.activeEdgeId || flow.visitedEdgeIds.has(edge.id)) {
        flowNodeIds.add(edge.from);
        flowNodeIds.add(edge.to);
      }
    }
  }

  const tierNodes: Node<TierNodeData>[] = layout.tierBoxes.map((box) => ({
    id: `tier-${box.id}`,
    type: "tier",
    position: { x: box.x, y: box.y },
    data: { label: box.label, tier: box.id },
    style: { width: box.width, height: box.height },
    draggable: false,
    selectable: false,
    focusable: false,
    zIndex: -1,
  }));

  const componentNodes: Node<ArchitectureNodeData>[] = system.nodes.map((node) => {
    const kind = getComponentKind(node.kind);
    const resolved = resolveService(node, kind, provider);

    return {
      id: node.id,
      type: "architecture",
      position: layout.positions[node.id] ?? { x: 0, y: 0 },
      selected: node.id === selectedNodeId,
      data: {
        kindId: node.kind,
        kindName: kind?.name ?? node.kind,
        label: resolved.label,
        genericLabel: node.label,
        category: kind?.category,
        mapped: resolved.mapped,
        dimmed: flow !== null && !flowNodeIds.has(node.id),
        inStep: stepNodeIds.has(node.id),
        provider,
      },
    };
  });

  const edges: Edge[] = system.edges.map((edge) => {
    const style = edgeStyles[edge.protocol ?? "default"];
    const isActiveStep = flow?.activeEdgeId === edge.id;
    const isVisitedStep = flow?.visitedEdgeIds.has(edge.id) ?? false;
    const touchesSelection =
      selectedNodeId !== null && (edge.from === selectedNodeId || edge.to === selectedNodeId);
    const emphasised = flow ? isActiveStep || isVisitedStep : touchesSelection;
    const dimmed = flow ? !emphasised : selectedNodeId !== null && !touchesSelection;
    const color = isActiveStep ? FLOW_COLOR : style.color;

    return {
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: "packet",
      label: edge.label,
      // The active step carries a packet dot instead of marching dashes.
      animated: !isActiveStep && style.animated,
      data: { packet: isActiveStep, packetColor: FLOW_COLOR },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      style: {
        stroke: color,
        strokeWidth: isActiveStep ? 3.5 : emphasised ? 2.5 : 1.5,
        strokeDasharray: isActiveStep ? undefined : style.dash,
        opacity: dimmed ? 0.15 : 1,
      },
      labelStyle: { fill: isActiveStep ? FLOW_COLOR : "var(--fg-soft)", fontSize: 11 },
      labelBgStyle: { fill: "var(--surface)" },
      labelBgPadding: [4, 2] as [number, number],
      zIndex: isActiveStep ? 2 : emphasised ? 1 : 0,
    };
  });

  return { nodes: [...tierNodes, ...componentNodes], edges };
}
