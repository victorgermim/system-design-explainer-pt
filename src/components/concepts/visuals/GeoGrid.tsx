"use client";

import { useState } from "react";
import { VisualFrame } from "./shared";

const COLS = 8;
const ROWS = 6;
// Driver positions as [col, row] — fixed so the page renders identically everywhere.
const DRIVERS: [number, number][] = [
  [0, 0], [1, 3], [2, 1], [2, 2], [3, 4], [4, 1], [4, 2], [4, 3], [5, 0], [5, 5],
  [6, 2], [6, 4], [7, 1], [1, 5], [3, 0], [7, 5], [0, 3], [5, 3],
];

export default function GeoGrid() {
  const [rider, setRider] = useState<[number, number]>([3, 2]);
  const near = (c: number, r: number) => Math.abs(c - rider[0]) <= 1 && Math.abs(r - rider[1]) <= 1;
  const candidates = DRIVERS.filter(([c, r]) => near(c, r)).length;
  const cellsSearched = Array.from({ length: COLS * ROWS }).filter((_, i) => near(i % COLS, Math.floor(i / COLS))).length;

  return (
    <VisualFrame
      title="Experimente: mova o passageiro"
      hint="A cidade é dividida em células. Clique em uma célula para mover o passageiro; o matching busca apenas nessa célula e nas vizinhas."
    >
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }} role="grid" aria-label="Grade da cidade">
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const c = i % COLS;
          const r = Math.floor(i / COLS);
          const isRider = rider[0] === c && rider[1] === r;
          const drivers = DRIVERS.filter(([dc, dr]) => dc === c && dr === r).length;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setRider([c, r])}
              aria-label={`Célula ${c},${r}${drivers ? `, ${drivers} motorista` : ""}${isRider ? ", passageiro aqui" : ""}`}
              className={`flex aspect-square items-center justify-center rounded-md text-base transition-colors ${
                near(c, r) ? "bg-accent-soft ring-1 ring-accent/40" : "bg-surface-2 hover:bg-line"
              }`}
            >
              {isRider ? "🧍" : drivers ? "🚗" : ""}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-fg-soft" aria-live="polite">
        Buscou em <span className="font-semibold text-fg">{cellsSearched}</span> de {COLS * ROWS} células e verificou{" "}
        <span className="font-semibold text-fg">{candidates}</span> de {DRIVERS.length} motoristas. Esses poucos candidatos são então
        classificados pelo tempo estimado de chegada (ETA) real nas vias.
      </p>
    </VisualFrame>
  );
}
