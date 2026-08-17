'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminRefundRequest, RefundRequestStatus } from '../../lib/types';

const STATUSES: RefundRequestStatus[] = ['PENDING', 'COMPLETED'];

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT_RELEASE: 'Deposit Release',
  DEPOSIT_PARTIAL: 'Partial Deposit Release',
  CANCELLATION: 'Cancellation',
};

export default function RefundRequestsPage() {
  const { show } = useToast();
  const [requests, setRequests] = useState<AdminRefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminApi.refundRequests(statusFilter || undefined).then((res) => setRequests(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter]);

  async function markComplete(r: AdminRefundRequest) {
    setBusyId(r.id);
    try {
      await adminApi.completeRefundRequest(r.id);
      show('Marked as refunded', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to update', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      title="Refund Requests"
      subtitle="Deposit releases queued for manual PayU refund — no live refund API is wired up yet, process these in the PayU merchant portal, then mark complete here."
      action={
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
                <th className="py-3 px-4">Guest</th>
                <th className="py-3 px-4">Car</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Requested</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-200">{r.booking?.customer.fullName ?? '—'}</p>
                    <p className="text-xs text-slate-500">{r.booking?.customer.phoneNumber}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{r.booking?.car.make} {r.booking?.car.model}</td>
                  <td className="py-3 px-4 text-slate-400">{TYPE_LABELS[r.type] ?? r.type}</td>
                  <td className="py-3 px-4 text-slate-200 font-semibold">₹{r.amount.toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${r.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {r.status === 'PENDING' && (
                      <button
                        disabled={busyId === r.id}
                        onClick={() => markComplete(r)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition"
                      >
                        Mark Refunded
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500">No refund requests{statusFilter ? ` with status ${statusFilter}` : ''}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
