'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import BottomNav from '../../components/BottomNav';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { ApiError, cashLogApi } from '../../lib/api';
import type { CashLogEntry, CashLogType } from '../../lib/types';

const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
const CATEGORIES = ['Booking Collection', 'Deposit Collected', 'Deposit Refund', 'Fuel', 'Maintenance', 'Salary', 'Other'];

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function relativeDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const wasYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  if (wasYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function CashLogInner() {
  const { show } = useToast();
  const [entries, setEntries] = useState<CashLogEntry[]>([]);
  const [summary, setSummary] = useState({ cashIn: 0, cashOut: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  function load() {
    setLoading(true);
    cashLogApi
      .list(60)
      .then((res) => {
        setEntries(res.data);
        setSummary(res.summary);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="border-b border-slate-800 px-4 py-4">
        <h1 className="font-extrabold text-lg">Cash Counter</h1>
        <p className="text-xs text-slate-500">Last 60 days</p>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-[11px] text-slate-500 mb-1">Cash In</p>
            <p className="text-lg font-extrabold text-emerald-400">{inr(summary.cashIn)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-[11px] text-slate-500 mb-1">Cash Out</p>
            <p className="text-lg font-extrabold text-red-400">{inr(summary.cashOut)}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-[11px] text-slate-500 mb-1">Net</p>
            <p className={`text-lg font-extrabold ${summary.net < 0 ? 'text-red-400' : 'text-slate-100'}`}>{inr(summary.net)}</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-4">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl transition mb-6"
        >
          + Log Cash
        </button>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading entries…</p>
        ) : entries.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-16">No cash entries in the last 60 days.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{e.category}</p>
                  {e.trip && (
                    <p className="text-xs text-slate-500 truncate">
                      {e.trip.customerName} · {e.trip.car.make} {e.trip.car.model} ({e.trip.car.registrationNo})
                    </p>
                  )}
                  {e.note && <p className="text-xs text-slate-500 truncate">{e.note}</p>}
                  <p className="text-[11px] text-slate-600 mt-0.5">{relativeDate(e.createdAt)}</p>
                </div>
                <p className={`text-sm font-bold shrink-0 ${e.type === 'CASH_IN' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {e.type === 'CASH_IN' ? '+' : '−'}{inr(e.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      <LogCashModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onDone={() => { setShowModal(false); load(); }}
        show={show}
      />

      <BottomNav />
    </div>
  );
}

function LogCashModal({ open, onClose, onDone, show }: {
  open: boolean; onClose: () => void; onDone: () => void; show: (m: string, t: 'success' | 'error') => void;
}) {
  const [type, setType] = useState<CashLogType>('CASH_IN');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setType('CASH_IN');
    setAmount('');
    setCategory(CATEGORIES[0]);
    setNote('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      show('Enter a valid amount', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await cashLogApi.create({ type, amount: amountNum, category, note: note.trim() || undefined });
      show('Cash logged', 'success');
      reset();
      onDone();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to log cash', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log Cash">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          {(['CASH_IN', 'CASH_OUT'] as CashLogType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition ${
                type === t
                  ? t === 'CASH_IN' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                  : 'bg-slate-950 border border-slate-800 text-slate-400'
              }`}
            >
              {t === 'CASH_IN' ? 'Cash In' : 'Cash Out'}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Amount (₹)</label>
          <input type="number" min={0} required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="Optional" />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white font-bold py-3 rounded-xl transition"
        >
          {submitting ? 'Logging…' : 'Log Entry'}
        </button>
      </form>
    </Modal>
  );
}

export default function CashLogPage() {
  return (
    <ProtectedRoute>
      <CashLogInner />
    </ProtectedRoute>
  );
}
