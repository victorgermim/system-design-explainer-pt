import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentCategory, ServiceProvider } from "@/types/schema";
import { componentCategoryLabels, components, usagesOfComponent } from "@/content";
import { providers } from "@/content/providers";
import { KindIcon } from "@/lib/icons";
import { getCategoryColor } from "@/lib/resolve";

export const metadata: Metadata = {
  title: "Componentes · System Design Explainer",
  description: "Todos os blocos de construção usados nos system designs, mapeados para AWS, Google Cloud, Azure e ferramentas de código aberto.",
};

const serviceProviders = providers.filter((p) => p.id !== "generic") as (typeof providers[number] & {
  id: ServiceProvider;
})[];

export default function ComponentsPage() {
  const groups = (Object.keys(componentCategoryLabels) as ComponentCategory[])
    .map((category) => ({ category, items: components.filter((c) => c.category === category) }))
    .filter((g) => g.items.length > 0 && g.category !== "client");

  return (
    <div className="px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-3xl font-bold text-fg">Componentes</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Os blocos de construção por trás de cada design, com o serviço padrão em cada nuvem e alternativas
        de código aberto. Abra um para ver todas as opções, quando usar e onde ele aparece.
      </p>

      <div className="mt-8 space-y-10">
        {groups.map(({ category, items }) => (
          <section key={category}>
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: getCategoryColor(category) }}>
              {componentCategoryLabels[category]}
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="w-60 px-4 py-2.5 font-semibold">Componente</th>
                    {serviceProviders.map((p) => (
                      <th key={p.id} className="px-4 py-2.5 font-semibold" style={{ color: p.accent }}>
                        {p.shortName}
                      </th>
                    ))}
                    <th className="w-24 px-4 py-2.5 font-semibold">Usado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((c) => {
                    const used = usagesOfComponent(c.id).length;
                    return (
                      <tr key={c.id} className="bg-surface/40 align-top">
                        <td className="px-4 py-3">
                          <Link href={`/components/${c.id}`} className="group flex items-center gap-2.5">
                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                              style={{ backgroundColor: `${getCategoryColor(c.category)}26`, color: getCategoryColor(c.category) }}
                            >
                              <KindIcon kindId={c.id} size={15} />
                            </span>
                            <span className="font-medium text-fg group-hover:underline">{c.name}</span>
                          </Link>
                        </td>
                        {serviceProviders.map((p) => {
                          const options = c.providers[p.id];
                          return (
                            <td key={p.id} className="px-4 py-3 text-fg-soft">
                              {options ? (
                                <>
                                  {options[0].name}
                                  {options.length > 1 && (
                                    <span className="ml-1 text-xs text-muted">+{options.length - 1}</span>
                                  )}
                                </>
                              ) : c.thirdParty.length > 0 ? (
                                <span className="text-xs text-muted">Terceiros</span>
                              ) : (
                                <span className="text-faint">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-muted">
                          {used > 0 ? `${used} sistema${used === 1 ? "" : "s"}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
