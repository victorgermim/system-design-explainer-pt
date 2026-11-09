"use client";

import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useRecordVisit } from "@/lib/visited";

/**
 * Desktop split view: diagram on the left, tabbed panel on the right. Smaller
 * screens stack the two. Both columns arrive server-rendered as props.
 */
export default function WorkspaceShell({
  left,
  right,
  category,
  slug,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  /** Sets the page's identity colour (see data-category in globals.css). */
  category: string;
  /** Recorded as visited for learning-path progress. */
  slug: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  useRecordVisit(slug);

  return (
    <div
      data-category={category}
      className={`lg:grid lg:h-full ${
        collapsed ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1.6fr)_minmax(360px,1fr)]"
      }`}
    >
      <section className="relative flex min-h-0 min-w-0 flex-col lg:h-full">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Mostrar painel de detalhes" : "Ocultar painel de detalhes"}
          title={collapsed ? "Mostrar painel de detalhes" : "Ocultar painel de detalhes"}
          className="absolute right-4 top-4 z-10 hidden rounded-lg border border-line bg-surface p-1.5 text-muted transition-colors hover:text-fg lg:block"
        >
          {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
        </button>
        {left}
      </section>
      <aside
        aria-label="Detalhes"
        className={`relative min-h-0 border-t border-line bg-surface lg:h-full lg:overflow-y-auto lg:border-l lg:border-t-0 ${
          collapsed ? "lg:hidden" : ""
        }`}
      >
        {right}
      </aside>
    </div>
  );
}
