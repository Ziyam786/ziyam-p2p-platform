'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminPayout, PayoutStatus } from '../../lib/types';

const STATUSES: PayoutStatus[] = ['HELD_IN_ESCROW', 'QUEUED_FOR_N1', 'SETTLED', 'FAILED'];

const STATUS_STYLES: Record<PayoutStatus, string> = {
  HELD_IN_ESCROW: 'bg-amber-500/10 text-amber-400',
  QUEUED_FOR_N1: 'bg-blue-500/10 text-blue-400',
  SETTLED: 'bg-emerald-500/10 text-emerald-400',
  FAILED: 'bg-red-500/10 text-red-400',
};

export default function PayoutsPage() {
  const { show } = useToast();
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminApi.payouts(statusFilter || undefined).then((res) => setPayouts(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter]);

  async function retry(p: AdminPayout) {
    setBusyId(p.id);
    try {
      await adminApi.retryPayout(p.id);
      show('Payout retried successfully', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Retry failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      title="Payouts"
      subtitle={`${payouts.length} ledger entries`}
      action={
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      }
    >
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4">Host</th>
                <th className="py-3 px-4">Gross</th>
                <th className="py-3 px-4">Ziyam Cut</th>
                <th className="py-3 px-4">Net Payout</th>
                <th className="py-3 px-4">Scheduled</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-3 px-4 font-medium text-slate-200">{p.host?.fullName ?? '—'}</td>
                  <td className="py-3 px-4 text-slate-400">₹{p.grossAmount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-400">₹{p.ziyamCut.toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-200 font-semibold">₹{p.netPayout.toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{new Date(p.scheduledFor).toLocaleDateString()}</td>
                  <td className="py-3 px-4"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[p.status]}`}>{p.status.replace('_', ' ')}</span></td>
                  <td className="py-3 px-4">
                    {p.status === 'FAILED' && (
                      <button
                        disabled={busyId === p.id}
                        onClick={() => retry(p)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition"
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
