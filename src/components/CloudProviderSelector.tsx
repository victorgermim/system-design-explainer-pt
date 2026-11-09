"use client";

import type { Provider } from "@/types/schema";
import { providers } from "@/content/providers";
import { useSlidingIndicator } from "@/lib/useSlidingIndicator";

interface CloudProviderSelectorProps {
  selected: Provider;
  onChange: (provider: Provider) => void;
}

export default function CloudProviderSelector({
  selected,
  onChange,
}: CloudProviderSelectorProps) {
  const activeIndex = providers.findIndex((p) => p.id === selected);
  const { ref, box } = useSlidingIndicator<HTMLDivElement>(activeIndex);
  const activeAccent = providers[activeIndex]?.accent;

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs font-medium text-muted sm:inline">Nuvem</span>
      <div ref={ref} className="relative flex flex-wrap rounded-lg bg-surface-2 p-0.5">
        {box && (
          <span
            aria-hidden
            className="shadow-soft absolute top-0.5 bottom-0.5 rounded-md transition-all duration-300 ease-out"
            style={{ left: box.left, width: box.width, backgroundColor: activeAccent }}
          />
        )}
        {providers.map((provider) => {
          const isActive = selected === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              data-seg
              onClick={() => onChange(provider.id)}
              aria-pressed={isActive}
              className={`relative rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-300 ${
                isActive
                  ? `text-[var(--on-provider)] ${box ? "" : "shadow-soft"}`
                  : "text-muted hover:text-fg"
              }`}
              style={
                isActive && !box
                  ? { backgroundColor: provider.accent }
                  : undefined
              }
            >
              {provider.shortName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
