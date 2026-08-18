'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminDisputeSupportRequest } from '../../lib/types';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-amber-500/10 text-amber-400',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400',
  RESOLVED: 'bg-emerald-500/10 text-emerald-400',
};

export default function DisputeSupportPage() {
  const { show } = useToast();
  const [requests, setRequests] = useState<AdminDisputeSupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminApi.disputeSupport(statusFilter || undefined).then((res) => setRequests(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter]);

  async function resolve(id: string) {
    setBusyId(id);
    try {
      await adminApi.resolveDisputeSupport(id);
      show('Marked resolved — ₹149 queued for deduction from the host\'s next payout', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to resolve', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      title="Dispute Support"
      subtitle={`${requests.length} requests`}
      action={
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      }
    >
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-slate-500">No dispute support requests{statusFilter ? ` with status ${statusFilter}` : ''}.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((r) => (
            <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold text-slate-200">{r.booking?.car.make} {r.booking?.car.model}</p>
                  <p className="text-xs text-slate-500">{r.booking?.customer.fullName} · {r.booking?.customer.phoneNumber}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[r.status]}`}>{r.status.replace('_', ' ')}</span>
              </div>
              <p className="text-sm text-slate-300 mb-1">{r.channel === 'PHONE' ? '📞 Phone' : '💬 WhatsApp'} support requested</p>
              {r.assignedAgent && <p className="text-xs text-slate-500 mb-3">Assigned to {r.assignedAgent.fullName}</p>}
              <p className="text-xs text-slate-500 mb-3">
                Host fee: ₹{r.hostFeeAmount} {r.hostFeeCharged ? '(queued for next payout)' : '(not yet charged)'}
              </p>
              {r.status !== 'RESOLVED' && (
                <button disabled={busyId === r.id} onClick={() => resolve(r.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition disabled:opacity-50">
                  {busyId === r.id ? 'Resolving…' : 'Mark Resolved'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
