"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { Provider, ServiceOption, ServiceProvider, SystemDesign } from "@/types/schema";
import { getCategoryColor, resolveService } from "@/lib/resolve";
import { getComponentKind, getConcept } from "@/content";
import { getProvider, providers } from "@/content/providers";

interface NodeDetailPanelProps {
  nodeId: string | null;
  system: SystemDesign;
  provider: Provider;
  onClose: () => void;
  /** "overlay" floats beside the diagram; "sheet" fills the details panel. */
  variant?: "overlay" | "sheet";
}

const serviceProviders = providers.filter(
  (p): p is typeof p & { id: ServiceProvider } => p.id !== "generic",
);

function OptionList({ options }: { options: ServiceOption[] }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {options.map((option) => (
        <li key={option.name} className="text-sm text-fg-soft">
          {option.name}
          {option.note && <span className="text-xs text-muted"> — {option.note}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function NodeDetailPanel({
  nodeId,
  system,
  provider,
  onClose,
  variant = "overlay",
}: NodeDetailPanelProps) {
  const systemNode = system.nodes.find((n) => n.id === nodeId);

  if (!systemNode) return null;

  const kind = getComponentKind(systemNode.kind);
  const resolved = resolveService(systemNode, kind, provider);
  const color = getCategoryColor(kind?.category);

  return (
    <aside
      className={`flex h-full w-full shrink-0 flex-col ${
        variant === "sheet" ? "bg-surface" : "border-l border-line bg-bg md:w-80"
      }`}
    >
      <div className="flex items-start justify-between border-b border-line px-5 py-4">
        <div>
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#fff]"
            style={{ backgroundColor: color }}
          >
            {kind?.name ?? systemNode.kind}
          </span>
          <h2 className="mt-2 text-base font-semibold text-fg">{systemNode.label}</h2>
          {resolved.mapped && (
            <p className="mt-0.5 text-sm" style={{ color: getProvider(provider).accent }}>
              {resolved.label}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Fechar painel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            Papel em {system.name}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-fg-soft">{systemNode.role}</p>
        </section>

        {kind && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              O que é
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-fg-soft">{kind.what}</p>
          </section>
        )}

        {kind && (Object.keys(kind.providers).length > 0 || kind.thirdParty.length > 0) && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Opções por provedor
            </h3>
            <div className="mt-2 space-y-2">
              {serviceProviders.map((p) => {
                const options = kind.providers[p.id];
                const override = systemNode.overrides?.[p.id];
                if (!options && !override) return null;
                const active = provider === p.id;
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg border px-3 py-2 ${active ? "" : "border-line"}`}
                    style={active ? { borderColor: p.accent } : undefined}
                  >
                    <p className="text-xs font-semibold" style={{ color: p.accent }}>
                      {p.shortName}
                    </p>
                    {override && (
                      <p className="mt-1 text-sm text-fg-soft">
                        {override} <span className="text-xs text-muted">— usado aqui</span>
                      </p>
                    )}
                    {options && <OptionList options={options} />}
                  </div>
                );
              })}
              {kind.thirdParty.length > 0 && (
                <div className="rounded-lg border border-line px-3 py-2">
                  <p className="text-xs font-semibold text-muted">Terceiros (qualquer nuvem)</p>
                  <OptionList options={kind.thirdParty} />
                </div>
              )}
            </div>
          </section>
        )}

        {kind && kind.whenToUse.length > 0 && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Quando usar
            </h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-fg-soft">
              {kind.whenToUse.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        )}

        {kind && kind.pitfalls.length > 0 && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Armadilhas
            </h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-fg-soft">
              {kind.pitfalls.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        )}

        {kind && kind.concepts.length > 0 && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Conceitos
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {kind.concepts.map((slug) => (
                <Link
                  key={slug}
                  href={`/concepts/${slug}`}
                  className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300 hover:bg-emerald-500/20"
                >
                  {getConcept(slug)?.name ?? slug}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {kind && (
        <Link
          href={`/components/${kind.id}`}
          className="border-t border-line px-5 py-3 text-sm font-medium text-indigo-300 hover:bg-surface hover:text-indigo-200"
        >
          Tudo sobre {kind.name.toLowerCase()} →
        </Link>
      )}
    </aside>
  );
}
