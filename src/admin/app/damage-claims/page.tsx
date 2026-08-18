'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminDamageClaim, DamageClaimStatus, TripIssueType } from '../../lib/types';

const STATUSES: DamageClaimStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'BILL_SUBMITTED', 'APPROVED', 'REJECTED'];

const STATUS_STYLES: Record<DamageClaimStatus, string> = {
  SUBMITTED: 'bg-amber-500/10 text-amber-400',
  UNDER_REVIEW: 'bg-blue-500/10 text-blue-400',
  BILL_SUBMITTED: 'bg-purple-500/10 text-purple-400',
  APPROVED: 'bg-red-500/10 text-red-400',
  REJECTED: 'bg-emerald-500/10 text-emerald-400',
};

const TYPE_LABELS: Record<TripIssueType, string> = { DAMAGE: 'Damage', FUEL: 'Fuel', FASTAG: 'FASTag' };
const REVIEWABLE_STATUSES: DamageClaimStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'BILL_SUBMITTED'];

export default function DamageClaimsPage() {
  const { show } = useToast();
  const [claims, setClaims] = useState<AdminDamageClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewing, setReviewing] = useState<AdminDamageClaim | null>(null);
  const [deduction, setDeduction] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    adminApi.damageClaims(statusFilter || undefined).then((res) => setClaims(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter]);

  function openReview(c: AdminDamageClaim) {
    setReviewing(c);
    setDeduction(String(c.estimatedCost));
    setNotes('');
  }

  async function resolve(status: 'APPROVED' | 'REJECTED') {
    if (!reviewing) return;
    setBusy(true);
    try {
      await adminApi.resolveDamageClaim(reviewing.id, {
        status,
        approvedDeduction: status === 'APPROVED' ? Number(deduction) : undefined,
        adminNotes: notes || undefined,
      });
      show(status === 'APPROVED' ? 'Claim approved' : 'Claim rejected — deposit queued for release', 'success');
      setReviewing(null);
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to resolve claim', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Trip Issue Reports"
      subtitle={`${claims.length} reports`}
      action={
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      }
    >
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : claims.length === 0 ? (
        <p className="text-slate-500">No damage claims{statusFilter ? ` with status ${statusFilter}` : ''}.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {claims.map((c) => (
            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="font-semibold text-slate-200">{c.booking?.car.make} {c.booking?.car.model} <span className="text-slate-500 font-normal">· {TYPE_LABELS[c.type]}</span></p>
                  <p className="text-xs text-slate-500">{c.reportedBy?.fullName} reported vs. lessee {c.booking?.customer.fullName}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[c.status]}`}>{c.status.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-sm text-slate-300 mb-2">{c.description}</p>
              <p className="text-xs text-slate-500 mb-3">
                Estimated ₹{c.estimatedCost.toLocaleString()} · Deposit held ₹{c.booking?.depositAmount.toLocaleString()}
                {c.approvedDeduction != null && ` · Approved ₹${c.approvedDeduction.toLocaleString()}`}
                {c.excessChargeAmount != null && ` · Excess ₹${c.excessChargeAmount.toLocaleString()} ${c.excessChargePaidAt ? '(paid)' : '(unpaid)'}`}
              </p>
              {c.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {c.images.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-700" />
                  ))}
                </div>
              )}
              {c.resolutionBillUrl && (
                <div className="mb-3 bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-purple-300 mb-1">Repair bill submitted — ₹{c.resolutionBillAmount?.toLocaleString()}</p>
                  <a href={c.resolutionBillUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:underline">View bill →</a>
                  {c.resolutionPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {c.resolutionPhotos.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={url} src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-slate-700" />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {REVIEWABLE_STATUSES.includes(c.status) && (
                <button onClick={() => openReview(c)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition">
                  Review
                </button>
              )}
              {c.adminNotes && <p className="text-xs text-slate-500 mt-2 italic">"{c.adminNotes}"</p>}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!reviewing} onClose={() => setReviewing(null)} title="Review Damage Claim">
        {reviewing && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">{reviewing.description}</p>
            <p className="text-xs text-slate-500">
              Estimated ₹{reviewing.estimatedCost.toLocaleString()} · Deposit held ₹{reviewing.booking?.depositAmount.toLocaleString()}
            </p>
            {reviewing.resolutionBillUrl && (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                <p className="text-xs font-semibold text-purple-300 mb-1">Host-submitted repair bill — ₹{reviewing.resolutionBillAmount?.toLocaleString()}</p>
                <a href={reviewing.resolutionBillUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:underline">View bill →</a>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Approved amount (₹)</label>
              <input
                type="number"
                min={1}
                value={deduction}
                onChange={(e) => setDeduction(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Not capped at the deposit — if this exceeds ₹{reviewing.booking?.depositAmount.toLocaleString()}, the guest is
                charged the difference directly through the app before the host is paid out. Approving fires a fast payout
                (well under 15 min) for whatever's already covered by the deposit.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" />
            </div>
            <div className="flex gap-3">
              <button disabled={busy} onClick={() => resolve('REJECTED')} className="flex-1 text-sm font-semibold py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition">
                Reject (full release)
              </button>
              <button disabled={busy || !deduction} onClick={() => resolve('APPROVED')} className="flex-1 text-sm font-semibold py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition">
                Approve deduction
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}
