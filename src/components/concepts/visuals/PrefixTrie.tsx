"use client";

import { useState } from "react";
import { VisualFrame } from "./shared";

const QUERIES: [string, number][] = [
  ["system design", 120],
  ["sync", 70],
  ["system", 90],
  ["syntax", 60],
  ["symbol", 30],
  ["sys admin", 40],
  ["car", 80],
  ["cart", 45],
  ["cat", 50],
  ["cache", 95],
];

/** Children letters reachable from a prefix, and the top-3 completions stored at that node. */
function lookup(prefix: string) {
  const matches = QUERIES.filter(([q]) => q.startsWith(prefix));
  const next = [...new Set(matches.map(([q]) => q[prefix.length]).filter(Boolean))];
  const top = [...matches].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { next, top, count: matches.length };
}

export default function PrefixTrie() {
  const [prefix, setPrefix] = useState("sy");
  const p = prefix.toLowerCase();
  const { next, top, count } = lookup(p);

  return (
    <VisualFrame
      title="Experimente: digite um prefixo"
      hint="Cada letra é um passo abaixo na trie. O nó em que você para já armazena as principais sugestões."
    >
      <input
        value={prefix}
        onChange={(e) => setPrefix(e.target.value.slice(0, 16))}
        aria-label="Prefixo"
        className="h-10 w-full max-w-xs rounded-lg border border-line bg-bg px-3 font-mono text-fg focus:border-accent focus:outline-none"
      />

      <div className="mt-4 flex flex-wrap items-center gap-1" aria-label="Caminho pela trie">
        <span className="rounded-md bg-surface-2 px-2 py-1 font-mono text-xs text-muted">root</span>
        {[...p].map((ch, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-faint">→</span>
            <span className="rounded-md bg-accent px-2 py-1 font-mono text-xs text-[#fff]">{ch === " " ? "␣" : ch}</span>
          </span>
        ))}
        {next.length > 0 && (
          <span className="ml-2 text-xs text-muted">
            filhos:{" "}
            {next.map((c) => (
              <code key={c} className="mx-0.5 rounded bg-surface-2 px-1.5 py-0.5 font-mono">
                {c === " " ? "␣" : c}
              </code>
            ))}
          </span>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-line p-3">
        <p className="text-xs font-medium text-muted">
          Principais sugestões armazenadas em “{p || "root"}” ({count} consultas abaixo deste nó)
        </p>
        {top.length > 0 ? (
          <ol className="mt-2 space-y-1 text-sm">
            {top.map(([q, n]) => (
              <li key={q} className="flex justify-between gap-4">
                <span className="font-mono text-fg">
                  <span className="text-accent">{q.slice(0, p.length)}</span>
                  {q.slice(p.length)}
                </span>
                <span className="text-muted">{n} buscas</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted">Nenhum nó para este prefixo — nada a sugerir.</p>
        )}
      </div>
    </VisualFrame>
  );
}
