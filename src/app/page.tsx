import Link from "next/link";
import { ArrowRight, Boxes, Cloud, Lightbulb, PlayCircle } from "lucide-react";
import SystemCatalogue, { type CatalogueCard } from "@/components/site/SystemCatalogue";
import HeroDiagram from "@/components/site/HeroDiagram";
import LearningPaths, { type LearningPath } from "@/components/site/LearningPaths";
import {
  components,
  concepts,
  difficultyLabels,
  getConcept,
  getSystem,
  systemCategoryLabels,
  systems,
} from "@/content";

const lenses = [
  {
    icon: Cloud,
    hue: "infrastructure",
    title: "Troque de nuvem",
    text: "Renomeie cada componente para AWS, Google Cloud, Azure ou código aberto com um clique.",
  },
  {
    icon: PlayCircle,
    hue: "mobility",
    title: "Reproduza passo a passo",
    text: "Acompanhe uma requisição salto a salto — enviar um vídeo, reservar um assento, pagar um lojista.",
  },
  {
    icon: Boxes,
    hue: "commerce-fintech",
    title: "Inspecione componentes",
    text: "Cada bloco de construção com suas opções por provedor, armadilhas e onde é usado.",
  },
  {
    icon: Lightbulb,
    hue: "bookings",
    title: "Aprenda os padrões",
    text: "Cache, sharding, fan-out, sagas, idempotência — explicados e ligados a designs reais.",
  },
];

const learningPaths = [
  {
    title: "Fundamentos",
    hue: "infrastructure",
    level: "Comece aqui",
    slugs: ["url-shortener", "pastebin", "rate-limiter", "typeahead"],
  },
  {
    title: "Sistemas em tempo real",
    hue: "mobility",
    level: "Intermediário",
    slugs: ["whatsapp", "websocket-scale", "live-sports", "uber"],
  },
  {
    title: "Mídia em escala",
    hue: "media-social",
    level: "Avançado",
    slugs: ["instagram", "twitter", "youtube", "netflix"],
  },
  {
    title: "Dinheiro e reservas",
    hue: "commerce-fintech",
    level: "Avançado",
    slugs: ["bookmyshow", "amazon", "payments", "bnpl"],
  },
];

export default function HomePage() {
  const hero = getSystem("url-shortener") ?? systems[0];

  const cards: CatalogueCard[] = systems.map((s) => ({
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    category: s.category,
    categoryLabel: systemCategoryLabels[s.category],
    difficulty: s.difficulty,
    difficultyLabel: difficultyLabels[s.difficulty],
    componentCount: s.nodes.length,
    flowCount: s.flows.length,
    complete: s.requirements.functional.length > 0,
    concepts: s.concepts.map((slug) => ({ slug, name: getConcept(slug)?.name ?? slug })),
  }));

  const paths: LearningPath[] = learningPaths.map(({ slugs, ...path }) => ({
    ...path,
    systems: slugs.flatMap((slug) => {
      const s = getSystem(slug);
      return s ? [{ slug, name: s.name }] : [];
    }),
  }));

  const categories = Object.entries(systemCategoryLabels)
    .filter(([value]) => systems.some((s) => s.category === value))
    .map(([value, label]) => ({ value, label }));

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Hero */}
        <section className="relative isolate grid items-center gap-10 py-10 md:py-16 lg:grid-cols-[1fr_1.15fr]">
          {/* Mesh gradient: three slow-drifting blurred blobs behind the hero. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_72%)]">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[var(--accent)] opacity-20 blur-3xl [animation:drift_18s_ease-in-out_infinite]" />
            <div className="absolute left-1/3 top-1/3 h-72 w-72 rounded-full bg-[var(--accent-2)] opacity-15 blur-3xl [animation:drift_22s_ease-in-out_infinite_reverse]" />
            <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-[var(--accent-3)] opacity-15 blur-3xl [animation:drift_26s_ease-in-out_infinite]" />
          </div>
          <div>
            <p className="text-sm font-medium text-accent">
              {systems.length} sistemas · {components.length} componentes · {concepts.length} conceitos
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-fg md:text-5xl">
              Como grandes sistemas são <span className="text-brand">construídos?</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
              Arquiteturas interativas para YouTube, Uber, Amazon e mais — alterne entre AWS, Google Cloud,
              Azure e ferramentas de código aberto, e acompanhe cada requisição salto a salto.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/systems/youtube"
                className="inline-flex items-center gap-2 bg-brand shadow-soft rounded-xl px-4 py-2.5 text-sm font-semibold text-[#fff] transition-all hover:-translate-y-0.5 hover:opacity-95"
              >
                Explorar YouTube <ArrowRight size={16} aria-hidden />
              </Link>
              <a
                href="#catalogue"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-line-strong"
              >
                Ver todos os sistemas
              </a>
            </div>
          </div>
          <HeroDiagram system={hero} />
        </section>

        {/* O que você pode fazer */}
        <section aria-labelledby="lenses" className="py-6">
          <h2 id="lenses" className="sr-only">
            O que você pode fazer
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {lenses.map(({ icon: Icon, hue, title, text }) => (
              <li
                key={title}
                data-category={hue}
                className="rounded-2xl border border-line bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-glow"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-cat-tint text-cat"
                  aria-hidden
                >
                  <Icon size={18} />
                </span>
                <h3 className="mt-3 font-semibold text-fg">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Trilhas de aprendizado: a dark band in both themes breaks up the page. */}
      <section
        aria-labelledby="paths"
        className="scope-dark relative isolate my-10 overflow-hidden bg-bg py-14"
      >
        <div aria-hidden className="bg-brand absolute inset-x-0 top-0 h-px opacity-60" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 -z-10 h-96 w-96 rounded-full bg-[var(--accent-2)] opacity-15 blur-3xl"
        />
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <h2 id="paths" className="text-2xl font-semibold tracking-tight text-fg">
            Trilhas de aprendizado
          </h2>
          <p className="mt-1 text-muted">
            Cada trilha se baseia nos padrões da anterior. O progresso é salvo neste navegador.
          </p>
          <LearningPaths paths={paths} />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* Catalogue */}
        <section id="catalogue" aria-labelledby="catalogue-title" className="scroll-mt-4 pb-16 pt-6">
          <h2 id="catalogue-title" className="text-2xl font-semibold tracking-tight text-fg">
            Todos os sistemas
          </h2>
          <SystemCatalogue
            cards={cards}
            categories={categories}
            conceptOptions={concepts.map((c) => ({ value: c.slug, label: c.name }))}
          />
        </section>
      </div>
    </div>
  );
}
