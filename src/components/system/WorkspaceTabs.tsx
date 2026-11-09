"use client";

import { useUrlParam } from "@/lib/useUrlParam";
import { updateSearchParams } from "@/lib/url";

export interface WorkspaceTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/** Tabs for the details panel; the active tab is kept in the URL as ?tab=. */
export default function WorkspaceTabs({ tabs }: { tabs: WorkspaceTab[] }) {
  const requested = useUrlParam("tab", tabs[0].id);
  const active = tabs.find((t) => t.id === requested) ?? tabs[0];

  return (
    <>
      <div
        role="tablist"
        aria-label="Detalhes do sistema"
        className="sticky top-0 z-[5] flex gap-1 overflow-x-auto border-b border-line bg-surface/95 px-3 pt-2 backdrop-blur"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              onClick={() => updateSearchParams({ tab: tab.id === tabs[0].id ? null : tab.id })}
              className={`shrink-0 border-b-2 px-3 pb-2.5 pt-1.5 text-sm font-medium transition-colors ${
                selected ? "border-cat text-fg" : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`panel-${active.id}`} aria-labelledby={`tab-${active.id}`} className="px-5 py-6">
        {active.content}
      </div>
    </>
  );
}
