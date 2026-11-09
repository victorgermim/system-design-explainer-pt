import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/site/SiteHeader";
import { systemCategoryLabels, systems } from "@/content";
import { buildSearchIndex } from "@/lib/search";
import { themeInitScript } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Absolute base for OG image URLs: an explicit site URL, else Vercel's production domain.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  title: "System Design Explainer",
  description:
    "Como YouTube, Instagram, Uber, Amazon e outros são construídos. Diagramas de arquitetura interativos que você pode alternar entre AWS, Google Cloud, Azure e ferramentas de código aberto.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const systemGroups = Object.entries(systemCategoryLabels)
    .map(([category, label]) => ({
      category,
      label,
      systems: systems
        .filter((s) => s.category === category)
        .map(({ slug, name, tagline, category }) => ({ slug, name, tagline, category })),
    }))
    .filter((group) => group.systems.length > 0);

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The theme script sets data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-bg">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-[#fff] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Ir para o conteúdo
        </a>
        <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
          <SiteHeader systemGroups={systemGroups} searchIndex={buildSearchIndex()} />
          {/* The single scroll container; section anchors and sticky headers live inside it. */}
          <main id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto scroll-smooth focus:outline-none">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
