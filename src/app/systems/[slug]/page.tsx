import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SystemPage from "@/components/system/SystemPage";
import { getSystem, systems } from "@/content";

// Only the systems in the content folder exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return systems.map((system) => ({ slug: system.slug }));
}

export async function generateMetadata(props: PageProps<"/systems/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const system = getSystem(slug);
  if (!system) return {};
  return {
    title: `System design do ${system.name} · System Design Explainer`,
    description: `${system.tagline}. ${system.description}`,
  };
}

export default async function Page(props: PageProps<"/systems/[slug]">) {
  const { slug } = await props.params;
  const system = getSystem(slug);
  if (!system) notFound();
  return <SystemPage system={system} />;
}
