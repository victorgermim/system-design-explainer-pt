"use client";

import { useState } from "react";
import { VisualButton, VisualFrame } from "./shared";

type Entry = { txn: string; account: string; debit: number; credit: number };

const PAYMENT: Entry[] = [
  { txn: "Pagamento #1001", account: "Compensação de cartão", debit: 100, credit: 0 },
  { txn: "Pagamento #1001", account: "A pagar ao lojista", debit: 0, credit: 97 },
  { txn: "Pagamento #1001", account: "Receita de taxas", debit: 0, credit: 3 },
];
const REFUND: Entry[] = [
  { txn: "Estorno #1001-R", account: "A pagar ao lojista", debit: 97, credit: 0 },
  { txn: "Estorno #1001-R", account: "Receita de taxas", debit: 3, credit: 0 },
  { txn: "Estorno #1001-R", account: "Compensação de cartão", debit: 0, credit: 100 },
];

const money = (n: number) => (n ? `$${n.toFixed(2)}` : "");

export default function LedgerTable() {
  const [refunded, setRefunded] = useState(false);
  const entries = refunded ? [...PAYMENT, ...REFUND] : PAYMENT;
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const balances = [...new Set(entries.map((e) => e.account))].map((account) => ({
    account,
    balance: entries.filter((e) => e.account === account).reduce((s, e) => s + e.debit - e.credit, 0),
  }));

  return (
    <VisualFrame
      title="Experimente: lançar um estorno"
      hint="Nada é editado. Um estorno são novos lançamentos que revertem o pagamento — e os débitos sempre são iguais aos créditos."
    >
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[460px] text-left text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Transação</th>
              <th className="px-3 py-2 font-medium">Conta</th>
              <th className="px-3 py-2 text-right font-medium">Débito</th>
              <th className="px-3 py-2 text-right font-medium">Crédito</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((e, i) => (
              <tr key={i} className={i >= PAYMENT.length ? "bg-amber-500/5" : ""}>
                <td className="px-3 py-2 text-muted">{e.txn}</td>
                <td className="px-3 py-2 text-fg">{e.account}</td>
                <td className="px-3 py-2 text-right font-mono text-fg-soft">{money(e.debit)}</td>
                <td className="px-3 py-2 text-right font-mono text-fg-soft">{money(e.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line-strong">
            <tr>
              <td className="px-3 py-2 font-semibold text-fg" colSpan={2}>
                Totais {totalDebit === totalCredit && <span className="ml-1 text-emerald-300">✓ balanceado</span>}
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-fg">{money(totalDebit)}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-fg">{money(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <VisualButton primary={!refunded} onClick={() => setRefunded(!refunded)}>
          {refunded ? "Desfazer estorno" : "Lançar um estorno"}
        </VisualButton>
        <p className="text-sm text-muted">
          Saldos (derivados dos lançamentos):{" "}
          {balances.map((b) => (
            <span key={b.account} className="mr-3 whitespace-nowrap">
              {b.account} <span className="font-mono text-fg">{b.balance >= 0 ? `$${b.balance}` : `−$${-b.balance}`}</span>
            </span>
          ))}
        </p>
      </div>
    </VisualFrame>
  );
}
