import ELK from "elkjs/lib/elk.bundled.js";
import type { ComponentCategory, SystemDesign } from "@/types/schema";
import { getComponentKind } from "@/content";

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 84;

/** Columns of the diagram, left to right. Every component category lands in one tier. */
export const tiers = [
  { id: "clients", label: "Clientes" },
  { id: "edge", label: "Borda e segurança" },
  { id: "services", label: "Serviços" },
  { id: "async", label: "Assíncrono e streaming" },
  { id: "data", label: "Dados" },
  { id: "platform", label: "Analytics e plataforma" },
] as const;
export type TierId = (typeof tiers)[number]["id"];

/** Each tier lane gets its own hue, matching the node category colours it mostly contains. */
export const tierHues: Record<TierId, string> = {
  clients: "#6366f1",
  edge: "#0ea5e9",
  services: "#22c55e",
  async: "#a855f7",
  data: "#ec4899",
  platform: "#14b8a6",
};

const tierByCategory: Record<ComponentCategory, TierId> = {
  client: "clients",
  edge: "edge",
  security: "edge",
  compute: "services",
  messaging: "async",
  storage: "data",
  database: "data",
  cache: "data",
  analytics: "platform",
  ml: "platform",
  ops: "platform",
  external: "platform",
};

export function tierOf(category: ComponentCategory | undefined): TierId {
  return category ? tierByCategory[category] : "services";
}

export interface SystemLayout {
  positions: Record<string, { x: number; y: number }>;
  /** Bounding box of each tier that has at least one node. */
  tierBoxes: { id: TierId; label: string; x: number; y: number; width: number; height: number }[];
}

const elk = new ELK();
const cache = new Map<string, Promise<SystemLayout>>();

const TIER_PADDING = 16;
const TIER_HEADER = 24;
const LAYER_SPACING = 36;
const BAND_SPACING = 12;
/** Extra vertical room inserted wherever one tier band ends and the next begins. */
const BAND_GAP = 2 * TIER_PADDING + TIER_HEADER + BAND_SPACING - LAYER_SPACING;

/** Layered top-to-bottom layout; ELK partitions keep each tier in its own horizontal band. */
export function layoutSystem(system: SystemDesign): Promise<SystemLayout> {
  const cached = cache.get(system.slug);
  if (cached) return cached;

  const tierIndex = new Map(tiers.map((t, i) => [t.id, i]));
  const nodeTier = new Map(
    system.nodes.map((n) => [n.id, tierOf(getComponentKind(n.kind)?.category)]),
  );

  const result = elk
    .layout({
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.partitioning.activate": "true",
        "elk.spacing.nodeNode": "24",
        // Tight spacing inside a tier; band headers are inserted afterwards.
        "elk.layered.spacing.nodeNodeBetweenLayers": String(LAYER_SPACING),
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      },
      children: system.nodes.map((n) => ({
        id: n.id,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        layoutOptions: { "elk.partitioning.partition": String(tierIndex.get(nodeTier.get(n.id)!)) },
      })),
      edges: system.edges.map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
    })
    .then((graph) => {
      // Partitions keep tiers in order, so pushing each tier down by its rank
      // among the tiers present opens a gap for band padding and headers.
      const presentTiers = tiers.filter((t) => system.nodes.some((n) => nodeTier.get(n.id) === t.id));
      const bandRank = new Map(presentTiers.map((t, i) => [t.id, i]));

      const positions: SystemLayout["positions"] = {};
      for (const child of graph.children ?? []) {
        const rank = bandRank.get(nodeTier.get(child.id)!) ?? 0;
        positions[child.id] = { x: child.x ?? 0, y: (child.y ?? 0) + rank * BAND_GAP };
      }

      const xs = Object.values(positions).map((p) => p.x);
      const left = Math.min(...xs) - TIER_PADDING;
      const right = Math.max(...xs) + NODE_WIDTH + TIER_PADDING;

      const tierBoxes = tiers.flatMap((tier) => {
        const ys = system.nodes
          .filter((n) => nodeTier.get(n.id) === tier.id)
          .map((n) => positions[n.id].y);
        if (ys.length === 0) return [];
        const top = Math.min(...ys) - TIER_PADDING - TIER_HEADER;
        const bottom = Math.max(...ys) + NODE_HEIGHT + TIER_PADDING;
        return [{ id: tier.id, label: tier.label, x: left, y: top, width: right - left, height: bottom - top }];
      });

      return { positions, tierBoxes };
    });

  cache.set(system.slug, result);
  return result;
}
