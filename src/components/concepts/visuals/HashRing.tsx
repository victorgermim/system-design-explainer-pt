"use client";

import { useMemo, useState } from "react";
import { VisualButton, VisualFrame, fnv1a, palette } from "./shared";

const KEYS = Array.from({ length: 16 }, (_, i) => `user:${i + 1}`);
const ALL_NODES = ["A", "B", "C", "D"];
const BASELINE = ["A", "B", "C"];

// Servers sit at fixed, spread-out positions so the picture is easy to read.
const NODE_ANGLES: Record<string, number> = { A: 20, B: 140, C: 260, D: 200 };
const keyAngle = (key: string) => fnv1a(key) % 360;
// Round so server and browser trig produce identical SVG attributes (avoids hydration mismatches).
const round = (v: number) => Math.round(v * 100) / 100;

/** Owner = first node clockwise from the key's position. */
function owners(nodes: string[]) {
  const ring = nodes.map((n) => ({ n, a: NODE_ANGLES[n] })).sort((x, y) => x.a - y.a);
  return Object.fromEntries(
    KEYS.map((k) => {
      const a = keyAngle(k);
      return [k, (ring.find((r) => r.a >= a) ?? ring[0]).n];
    }),
  );
}

export default function HashRing() {
  const [nodes, setNodes] = useState(BASELINE);
  const baseline = useMemo(() => owners(BASELINE), []);
  const current = useMemo(() => owners(nodes), [nodes]);
  const moved = KEYS.filter((k) => baseline[k] !== current[k]);

  const R = 110;
  const point = (deg: number, r = R) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: round(140 + r * Math.cos(rad)), y: round(140 + r * Math.sin(rad)) };
  };
  const colour = (node: string) => palette[ALL_NODES.indexOf(node)];

  return (
    <VisualFrame
      title="Experimente: altere o cluster"
      hint="As chaves (pontos pequenos) pertencem ao próximo servidor no sentido horário. Adicione ou remova um servidor e veja como poucas chaves se movem."
    >
      <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
        <svg viewBox="0 0 280 280" className="w-full max-w-[280px]" role="img" aria-label="Anel de hash">
          <circle cx="140" cy="140" r={R} fill="none" stroke="var(--line-strong)" strokeWidth="2" />
          {KEYS.map((k) => {
            const p = point(keyAngle(k));
            const isMoved = moved.includes(k);
            return (
              <circle
                key={k}
                cx={p.x}
                cy={p.y}
                r={isMoved ? 6 : 4.5}
                fill={colour(current[k])}
                stroke={isMoved ? "var(--fg)" : "none"}
                strokeWidth="2"
              >
                <title>{`${k} → nó ${current[k]}`}</title>
              </circle>
            );
          })}
          {nodes.map((n) => {
            const p = point(NODE_ANGLES[n]);
            const label = point(NODE_ANGLES[n], R + 22);
            return (
              <g key={n}>
                <rect x={p.x - 9} y={p.y - 9} width="18" height="18" rx="4" fill={colour(n)} />
                <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--fg)">
                  {n}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex-1 space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <VisualButton primary={!nodes.includes("D")} onClick={() => setNodes(nodes.includes("D") ? nodes.filter((n) => n !== "D") : [...nodes, "D"])}>
              {nodes.includes("D") ? "Remover servidor D" : "Adicionar servidor D"}
            </VisualButton>
            <VisualButton onClick={() => setNodes(nodes.includes("B") ? nodes.filter((n) => n !== "B") : [...nodes, "B"].sort())}>
              {nodes.includes("B") ? "Derrubar servidor B" : "Restaurar servidor B"}
            </VisualButton>
          </div>
          <p className="text-fg-soft">
            <span className="text-2xl font-semibold text-fg">{moved.length}</span> de {KEYS.length} chaves se moveram
            (pontos contornados).
          </p>
          <p className="text-muted">
            {nodes.length === BASELINE.length && nodes.every((n) => BASELINE.includes(n)) ? (
              <>Altere o cluster para comparar com o <code className="font-mono text-[12px]">hash mod N</code> simples.</>
            ) : (
              <>
                Com o <code className="font-mono text-[12px]">hash mod N</code> simples, ir de 3 para {nodes.length} servidores
                remapearia cerca de {Math.round((1 - 1 / Math.max(nodes.length, BASELINE.length)) * 100)}% das chaves — todo cache ficaria
                frio de uma vez.
              </>
            )}
          </p>
        </div>
      </div>
    </VisualFrame>
  );
}
