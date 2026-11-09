import { ogCard, ogSize } from "@/lib/og";
import { getConcept, getSystem, systemCategoryLabels, systems } from "@/content";

export const alt = "Visão geral do system design";
export const size = ogSize;
export const contentType = "image/png";
// Rendered once at build time for the static export.
export const dynamic = "force-static";

export function generateStaticParams() {
  return systems.map((system) => ({ slug: system.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const system = getSystem(slug);
  if (!system) return ogCard({ eyebrow: "System design", title: slug, subtitle: "" });

  return ogCard({
    eyebrow: `${systemCategoryLabels[system.category]} · system design`,
    title: system.name,
    subtitle: system.tagline,
    chips: system.concepts.slice(0, 3).map((c) => getConcept(c)?.name ?? c),
  });
}
