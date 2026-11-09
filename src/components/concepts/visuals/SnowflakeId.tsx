"use client";

import { useState } from "react";
import { VisualButton, VisualFrame } from "./shared";

const EPOCH = BigInt(1288834974657); // Twitter's custom epoch (Nov 2010)
const WORKER = BigInt(7);
const segments = [
  { label: "Sinal", bits: 1, colour: "var(--faint)", start: 0 },
  { label: "Timestamp (ms desde a época)", bits: 41, colour: "#6366f1", start: 1 },
  { label: "Worker id", bits: 10, colour: "#f59e0b", start: 42 },
  { label: "Sequência", bits: 12, colour: "#10b981", start: 52 },
];

// Fixed starting example so server and client render the same thing.
const START = { ms: BigInt(1793500000000), seq: BigInt(0) };

const build = (ms: bigint, seq: bigint) => ((ms - EPOCH) << BigInt(22)) | (WORKER << BigInt(12)) | seq;

export default function SnowflakeId() {
  const [state, setState] = useState(START);
  const id = build(state.ms, state.seq);
  const binary = id.toString(2).padStart(64, "0");

  const generate = () => {
    const now = BigInt(Date.now());
    setState((prev) => ({ ms: now, seq: now === prev.ms ? (prev.seq + BigInt(1)) & BigInt(4095) : BigInt(0) }));
  };

  return (
    <VisualFrame
      title="Experimente: gerar IDs"
      hint="64 bits: o tempo vem primeiro (para que os IDs sejam ordenados por criação), depois qual máquina o criou e, por fim, um contador por milissegundo."
    >
      <div className="flex overflow-hidden rounded-lg border border-line" role="img" aria-label="Layout de ID de 64 bits">
        {segments.map((seg) => {
          const bits = binary.slice(seg.start, seg.start + seg.bits);
          return (
            <div key={seg.label} style={{ flexGrow: seg.bits, borderTopColor: seg.colour }} className="min-w-0 border-t-4 bg-surface-2 px-1.5 py-1.5">
              <p className="truncate text-[10px] font-medium text-muted">
                {seg.label} · {seg.bits}
              </p>
              <p className="truncate font-mono text-[10px] text-fg-soft">{bits}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <VisualButton primary onClick={generate}>
          Gerar ID
        </VisualButton>
        <code className="rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-sm text-fg">{id.toString()}</code>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">Criado em</dt>
          <dd className="font-mono text-fg">{new Date(Number(state.ms)).toISOString().replace("T", " ").slice(0, 23)}</dd>
        </div>
        <div>
          <dt className="text-muted">Worker</dt>
          <dd className="font-mono text-fg">{WORKER.toString()}</dd>
        </div>
        <div>
          <dt className="text-muted">Sequência</dt>
          <dd className="font-mono text-fg">{state.seq.toString()}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted">
        Clique rapidamente: dentro do mesmo milissegundo apenas a sequência muda, permitindo que um worker gere 4.096 IDs por
        milissegundo sem consultar ninguém.
      </p>
    </VisualFrame>
  );
}
