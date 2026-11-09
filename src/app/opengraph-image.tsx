import { ogCard, ogSize } from "@/lib/og";
import { systems } from "@/content";

export const alt = "System Design Explainer — como grandes sistemas são construídos, em qualquer nuvem";
export const size = ogSize;
export const contentType = "image/png";
// Rendered once at build time for the static export.
export const dynamic = "force-static";

export default function Image() {
  return ogCard({
    eyebrow: `${systems.length} system designs`,
    title: "Como grandes sistemas são construídos?",
    subtitle: "Arquiteturas interativas que você pode alternar entre AWS, Google Cloud, Azure e código aberto.",
    chips: ["AWS", "Google Cloud", "Azure", "Código aberto"],
  });
}
