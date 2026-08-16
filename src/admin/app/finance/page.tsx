'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { financeApi } from '../../lib/api';
import type { BalanceSheetData, CommandCenterData, MonthlyBalanceRow, OutstandingRow, OutstandingType } from '../../lib/types';

const rowInput = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500';

function inr(n: number) {
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'positive' | 'negative' | 'neutral' }) {
  const t = tone ?? (value >= 0 ? 'positive' : 'negative');
  const color = t === 'positive' ? 'text-emerald-400' : t === 'negative' ? 'text-red-400' : 'text-white';
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-extrabold ${color}`}>{inr(value)}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-slate-500 mb-1">{label}</label>{children}</div>;
}

export default function FinancePage() {
  const { show } = useToast();
  const [tab, setTab] = useState<'command-center' | 'balance-sheet' | 'outstandings' | 'ledger'>('command-center');
  const [cc, setCc] = useState<CommandCenterData | null>(null);
  const [bs, setBs] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([financeApi.commandCenter(), financeApi.balanceSheet()])
      .then(([c, b]) => { setCc(c.data); setBs(b.data); })
      .catch((err) => show(err.message ?? 'Failed to load finance data', 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <AdminShell title="Financial ERP" subtitle="Command Center, Balance Sheet, and Receivables & Payables">
      <div className="flex gap-1 border-b border-slate-800 mb-6">
        {([
          ['command-center', 'Command Center'],
          ['balance-sheet', 'Balance Sheet'],
          ['outstandings', 'Outstanding Dues & Payables'],
          ['ledger', 'Monthly Cash Ledger'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${
              tab === key ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading || !cc || !bs ? (
        <p className="text-slate-500">Loading…</p>
      ) : tab === 'command-center' ? (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Metric label="Cash Position" value={cc.cashPosition} tone="neutral" />
            <Metric label="Money In" value={cc.moneyIn} tone="positive" />
            <Metric label="Money Out" value={-cc.moneyOut} tone="negative" />
            <Metric label="Bottom Line" value={cc.bottomLine} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Metric label="Retained Earnings" value={cc.retainedEarnings} tone="neutral" />
            <Metric label="Opening Capital" value={cc.openingCapital} tone="neutral" />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Activity</p>
              <p className="text-sm text-slate-300">{cc.tripCount} platform trips · {cc.collectionCount} direct collections logged</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-6">
            Cash Position and Retained Earnings are cumulative, all-time figures. A platform booking counts as
            "credited" revenue once explicitly marked received, or once its expected credit date has passed.
          </p>
        </div>
      ) : tab === 'balance-sheet' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-slate-100 mb-4">What We Own (Assets)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Cash</span><span className="text-slate-100 font-semibold">{inr(bs.cash)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Receivables</span><span className="text-slate-100 font-semibold">{inr(bs.receivables)}</span></div>
              <div className="flex justify-between border-t border-slate-800 pt-2 mt-2"><span className="text-slate-300 font-bold">Total Assets</span><span className="text-emerald-400 font-extrabold">{inr(bs.assets)}</span></div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-bold text-slate-100 mb-4">What We Owe (Liabilities)</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Payables</span><span className="text-slate-100 font-semibold">{inr(bs.payables)}</span></div>
              <div className="flex justify-between border-t border-slate-800 pt-2 mt-2"><span className="text-slate-300 font-bold">Total Liabilities</span><span className="text-red-400 font-extrabold">{inr(bs.liabilities)}</span></div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:col-span-2">
            <h3 className="font-bold text-slate-100 mb-4">Equity</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><p className="text-slate-500 text-xs mb-1">Opening Capital</p><p className="font-semibold text-slate-100">{inr(bs.openingCapital)}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">Retained Earnings</p><p className="font-semibold text-slate-100">{inr(bs.retainedEarnings)}</p></div>
              <div><p className="text-slate-500 text-xs mb-1">Total Equity</p><p className="font-extrabold text-brand-400">{inr(bs.equity)}</p></div>
            </div>
          </div>
        </div>
      ) : tab === 'outstandings' ? (
        <OutstandingsTab show={show} />
      ) : (
        <LedgerTab show={show} />
      )}
    </AdminShell>
  );
}

function OutstandingsTab({ show }: { show: (m: string, t: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<OutstandingRow[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [expectedDate, setExpectedDate] = useState('');
  const [paymentTo, setPaymentTo] = useState('');
  const [amountOwed, setAmountOwed] = useState('');
  const [outstandingType, setOutstandingType] = useState<OutstandingType>('RECEIVABLE');
  const [sourceType, setSourceType] = useState('A Trip');

  function load() {
    setLoading(true);
    financeApi.outstandings({ type: typeFilter || undefined }).then((res) => setRows(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [typeFilter]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!expectedDate || !paymentTo || !amountOwed) return show('Fill in Expected Date, Payment To, and Amount', 'error');
    setBusy(true);
    try {
      await financeApi.addOutstanding({ expectedDate, paymentTo, amountOwed: Number(amountOwed), outstandingType, sourceType });
      show('Outstanding logged', 'success');
      setExpectedDate(''); setPaymentTo(''); setAmountOwed('');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to log', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function settle(id: string) {
    setBusy(true);
    try {
      await financeApi.settleOutstanding(id);
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to update', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this entry?')) return;
    setBusy(true);
    try {
      await financeApi.deleteOutstanding(id);
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to delete', 'error');
    } finally {
      setBusy(false);
    }
  }

  const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div>
      <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
        <Field label="Type">
          <select value={outstandingType} onChange={(e) => setOutstandingType(e.target.value as OutstandingType)} className={`${rowInput} w-full`}>
            <option value="RECEIVABLE">Receivable — Owed To Us</option>
            <option value="PAYABLE">Payable — We Owe</option>
          </select>
        </Field>
        <Field label="Owed To / By"><input value={paymentTo} onChange={(e) => setPaymentTo(e.target.value)} className={`${rowInput} w-full`} placeholder="Platform / vendor / host name" /></Field>
        <Field label="Amount (₹)"><input type="number" min={0} value={amountOwed} onChange={(e) => setAmountOwed(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <Field label="Expected Date"><input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <Field label="Source">
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={`${rowInput} w-full`}>
            {['A Trip', 'A Direct Collection', 'A Due We Owe', 'A Payment We Made'].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <button type="submit" disabled={busy} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">Log Entry</button>
      </form>

      <div className="flex gap-2 mb-4">
        {['', 'RECEIVABLE', 'PAYABLE'].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${typeFilter === t ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
            {t === '' ? 'All' : t === 'RECEIVABLE' ? 'Receivables' : 'Payables'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-center py-12">No outstanding dues logged.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const due = daysUntil(r.expectedDate);
            const dueLabel = r.status === 'PAID' ? null : due < 0 ? `${-due}d overdue` : due === 0 ? 'Due today' : due === 1 ? 'Due tomorrow' : `Due in ${due}d`;
            return (
              <div key={r.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-100">{r.paymentTo} <span className="text-slate-500 font-normal">· {r.sourceType ?? r.outstandingType}</span></p>
                  <p className="text-xs text-slate-500">{new Date(r.expectedDate).toLocaleDateString()} {dueLabel && <span className={due < 0 ? 'text-red-400' : 'text-amber-400'}> · {dueLabel}</span>}</p>
                </div>
                <span className={`text-sm font-bold shrink-0 mx-4 ${r.outstandingType === 'RECEIVABLE' ? 'text-emerald-400' : 'text-red-400'}`}>{inr(r.amountOwed)}</span>
                {r.status === 'PAID' ? (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 shrink-0">✓ {r.outstandingType === 'RECEIVABLE' ? 'Received' : 'Paid'}</span>
                ) : (
                  <button disabled={busy} onClick={() => settle(r.id)} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition shrink-0">
                    Mark {r.outstandingType === 'RECEIVABLE' ? 'Received' : 'Paid'}
                  </button>
                )}
                <button disabled={busy} onClick={() => remove(r.id)} className="text-xs font-semibold text-slate-500 hover:text-red-400 px-2 ml-2 shrink-0">✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LedgerTab({ show }: { show: (m: string, t: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<MonthlyBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');

  function load() {
    setLoading(true);
    financeApi.monthlyBalances().then((res) => setRows(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!month || !openingBalance) return show('Fill in Month and Opening Balance', 'error');
    setBusy(true);
    try {
      await financeApi.setMonthlyBalance(month, { openingBalance: Number(openingBalance), closingBalance: closingBalance ? Number(closingBalance) : undefined });
      show('Monthly balance saved', 'success');
      setOpeningBalance(''); setClosingBalance('');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to save', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <Field label="Month"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <Field label="Opening Balance (₹)"><input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <Field label="Closing Balance (₹)"><input type="number" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} placeholder="optional" className={`${rowInput} w-full`} /></Field>
        <button type="submit" disabled={busy} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">Save</button>
      </form>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-center py-12">No monthly balances recorded yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
              <th className="py-2">Month</th><th className="py-2">Opening</th><th className="py-2">Closing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((r) => (
              <tr key={r.month}>
                <td className="py-3 font-semibold text-slate-200">{r.month}</td>
                <td className="py-3 text-slate-300">{inr(r.openingBalance)}</td>
                <td className="py-3 text-slate-300">{r.closingBalance != null ? inr(r.closingBalance) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
