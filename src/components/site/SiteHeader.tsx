"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, Network, Search, X } from "lucide-react";
import type { SystemCategory } from "@/types/schema";
import type { SearchItem } from "@/lib/search-match";
import SearchPalette from "./SearchPalette";
import ThemeToggle from "./ThemeToggle";

export interface NavSystem {
  slug: string;
  name: string;
  tagline: string;
  category: SystemCategory;
}

type SystemGroup = { category: string; label: string; systems: NavSystem[] };

/** Static export serves pages with a trailing slash; compare without it. */
const normalise = (path: string) => (path.length > 1 ? path.replace(/\/$/, "") : path);

export default function SiteHeader({
  systemGroups,
  searchIndex,
}: {
  systemGroups: SystemGroup[];
  searchIndex: SearchItem[];
}) {
  const pathname = normalise(usePathname());
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setMenuOpen(false);
        setSearchOpen(true);
      }
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const openSearch = () => {
    setDrawerOpen(false);
    setMenuOpen(false);
    setSearchOpen(true);
  };
  const closeAll = () => {
    setDrawerOpen(false);
    setMenuOpen(false);
  };

  const onSystems = pathname === "/" || pathname.startsWith("/systems");
  const navLink = (href: string, label: string) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        href={href}
        onClick={closeAll}
        aria-current={active ? "page" : undefined}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
          active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="relative z-30 shrink-0 bg-bg/85 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-4 md:px-6">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir navegação"
          aria-expanded={drawerOpen}
          className="rounded-lg p-1.5 text-fg-soft hover:bg-surface-2 md:hidden"
        >
          <Menu size={20} />
        </button>

        <Link href="/" onClick={closeAll} className="mr-2 flex items-center gap-2 font-semibold text-fg">
          <span className="bg-brand flex h-7 w-7 items-center justify-center rounded-lg text-[#fff] shadow-soft" aria-hidden>
            <Network size={16} />
          </span>
          <span className="truncate">System Design Explainer</span>
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                onSystems ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              Sistemas
              <ChevronDown size={14} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {menuOpen && (
              <div className="shadow-soft absolute left-0 top-full mt-2 w-[min(92vw,960px)] rounded-2xl border border-line bg-surface p-5">
                <div className="grid grid-cols-2 gap-6 lg:grid-cols-5">
                  {systemGroups.map((group) => (
                    <div key={group.label} data-category={group.category}>
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">
                        <span className="h-2 w-2 rounded-full bg-cat" aria-hidden />
                        {group.label}
                      </p>
                      <ul className="space-y-0.5">
                        {group.systems.map((s) => (
                          <li key={s.slug}>
                            <Link
                              href={`/systems/${s.slug}`}
                              onClick={closeAll}
                              title={s.tagline}
                              aria-current={pathname === `/systems/${s.slug}` ? "page" : undefined}
                              className={`block rounded-md px-2 py-1 text-sm transition-colors ${
                                pathname === `/systems/${s.slug}`
                                  ? "bg-cat-tint font-medium text-fg"
                                  : "text-fg-soft hover:bg-cat-tint hover:text-fg"
                              }`}
                            >
                              {s.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <Link href="/" onClick={closeAll} className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
                  Ver todos os sistemas →
                </Link>
              </div>
            )}
          </div>
          {navLink("/components", "Componentes")}
          {navLink("/concepts", "Conceitos")}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={openSearch}
            aria-label="Buscar"
            className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg md:w-56"
          >
            <Search size={15} aria-hidden />
            <span className="hidden flex-1 text-left md:inline">Buscar…</span>
            <kbd className="hidden rounded border border-line px-1.5 text-[10px] md:inline">Ctrl K</kbd>
          </button>
          <div className="hidden md:block">
            <ThemeToggle compact />
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navegação">
          <div className="absolute inset-0 bg-bg/70" onClick={() => setDrawerOpen(false)} />
          <aside className="relative flex h-full w-80 max-w-[88vw] flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-semibold text-fg">Menu</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fechar navegação"
                className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
              >
                <X size={18} />
              </button>
            </div>
            <nav aria-label="Celular" className="flex-1 overflow-y-auto px-3 py-3">
              <div className="mb-3 flex gap-1">
                {navLink("/", "Sistemas")}
                {navLink("/components", "Componentes")}
                {navLink("/concepts", "Conceitos")}
              </div>
              {systemGroups.map((group) => (
                <div key={group.label} className="mb-4" data-category={group.category}>
                  <p className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
                    <span className="h-2 w-2 rounded-full bg-cat" aria-hidden />
                    {group.label}
                  </p>
                  {group.systems.map((s) => (
                    <Link
                      key={s.slug}
                      href={`/systems/${s.slug}`}
                      onClick={closeAll}
                      aria-current={pathname === `/systems/${s.slug}` ? "page" : undefined}
                      className={`block rounded-md px-2 py-1.5 text-sm ${
                        pathname === `/systems/${s.slug}` ? "bg-cat-tint font-medium text-fg" : "text-fg-soft"
                      }`}
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className="border-t border-line p-3">
              <ThemeToggle />
            </div>
          </aside>
        </div>
      )}

      {/* Gradient hairline under the header. */}
      <div className="bg-brand h-px opacity-60" aria-hidden />

      <SearchPalette items={searchIndex} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
