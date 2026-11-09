import {
  componentKindSchema,
  conceptSchema,
  systemSchema,
  type ComponentCategory,
  type ConceptFamily,
  type ComponentKind,
  type Concept,
  type SystemCategory,
  type SystemDesign,
  type SystemNode,
} from "@/types/schema";
import { componentCatalogue } from "./components";
import { conceptFamilyBySlug, conceptInputs } from "./concepts";
import { conceptDiagrams } from "./conceptDiagrams";
import { systemInputs } from "./systems";

/** Parsed content with defaults applied. Throws at build time if a file is malformed. */
export const components: ComponentKind[] = componentCatalogue.map((c) => componentKindSchema.parse(c));
export const systems: SystemDesign[] = systemInputs.map((s) => systemSchema.parse(s));
export const concepts: Concept[] = conceptInputs
  .map((c) => conceptSchema.parse({ ...c, family: conceptFamilyBySlug[c.slug], ...conceptDiagrams[c.slug] }))
  .sort((a, b) => a.name.localeCompare(b.name));

const componentsById = new Map(components.map((c) => [c.id, c]));
const conceptsBySlug = new Map(concepts.map((c) => [c.slug, c]));

export function getComponentKind(id: string): ComponentKind | undefined {
  return componentsById.get(id);
}

export function getSystem(slug: string): SystemDesign | undefined {
  return systems.find((s) => s.slug === slug);
}

export function getConcept(slug: string): Concept | undefined {
  return conceptsBySlug.get(slug);
}

/** Every place a component kind appears, for "Used in" lists. */
export function usagesOfComponent(kindId: string): { system: SystemDesign; nodes: SystemNode[] }[] {
  return systems
    .map((system) => ({ system, nodes: system.nodes.filter((n) => n.kind === kindId) }))
    .filter((u) => u.nodes.length > 0);
}

/** Wraps a concept's diagram as a minimal SystemDesign so the shared diagram engine can render it. */
export function conceptDiagramSystem(concept: Concept): SystemDesign | null {
  if (!concept.diagram) return null;
  return {
    slug: `concept-${concept.slug}`,
    name: concept.name,
    tagline: concept.summary,
    description: concept.summary,
    category: "infrastructure",
    difficulty: 1,
    concepts: [],
    requirements: { functional: [], nonFunctional: [] },
    apis: [],
    estimates: [],
    dataModel: [],
    nodes: concept.diagram.nodes,
    edges: concept.diagram.edges,
    flows: concept.diagram.flows,
    bottlenecks: [],
    scaling: [],
    extensions: [],
  };
}

export function systemsUsingConcept(slug: string): SystemDesign[] {
  return systems.filter((s) => s.concepts.includes(slug));
}

export function componentsUsingConcept(slug: string): ComponentKind[] {
  return components.filter((c) => c.concepts.includes(slug));
}

export const systemCategoryLabels: Record<SystemCategory, string> = {
  "media-social": "Mídia e Social",
  mobility: "Mobilidade e Logística",
  "commerce-fintech": "Comércio e Fintech",
  bookings: "Reservas e Marketplaces",
  infrastructure: "Blocos de Construção",
};

export const conceptFamilyLabels: Record<ConceptFamily, string> = {
  data: "Dados e armazenamento",
  scale: "Escala e distribuição",
  messaging: "Mensageria e fluxo",
  reliability: "Confiabilidade e correção",
  security: "Segurança",
};

export const difficultyLabels = { 1: "Iniciante", 2: "Intermediário", 3: "Avançado" } as const;

export const componentCategoryLabels: Record<ComponentCategory, string> = {
  client: "Clientes",
  edge: "Borda e redes",
  security: "Segurança e identidade",
  compute: "Computação",
  messaging: "Mensageria",
  storage: "Armazenamento",
  database: "Bancos de dados e busca",
  cache: "Cache",
  analytics: "Analytics e processamento",
  ml: "Machine learning",
  ops: "Operações",
  external: "Serviços externos",
};
