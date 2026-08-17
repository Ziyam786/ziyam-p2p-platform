'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminReview } from '../../lib/types';

export default function ReviewsPage() {
  const { show } = useToast();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminApi.reviews().then((res) => setReviews(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function remove(r: AdminReview) {
    if (!confirm('Delete this review? This cannot be undone — use Hide instead if you might need it later.')) return;
    setBusyId(r.id);
    try {
      await adminApi.deleteReview(r.id);
      show('Review deleted', 'success');
      setReviews((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleHidden(r: AdminReview) {
    setBusyId(r.id);
    try {
      await adminApi.setReviewHidden(r.id, !r.hidden);
      show(r.hidden ? 'Review unhidden — visible on the site again' : 'Review hidden from public view', 'success');
      setReviews((prev) => prev.map((x) => (x.id === r.id ? { ...x, hidden: !r.hidden } : x)));
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell title="Reviews" subtitle={`${reviews.length} reviews · moderate inappropriate content`}>
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : reviews.length === 0 ? (
        <p className="text-slate-500">No reviews yet.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className={`bg-slate-900 border rounded-2xl p-5 flex justify-between gap-4 ${r.hidden ? 'border-amber-500/40' : 'border-slate-800'}`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-200 text-sm">{r.author?.fullName ?? 'Lessee'}</span>
                  <span className="text-amber-400 text-xs">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  {r.hidden && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">HIDDEN</span>}
                </div>
                <p className="text-xs text-slate-500 mb-2">{r.car?.make} {r.car?.model} · {new Date(r.createdAt).toLocaleDateString()}</p>
                {r.comment && <p className="text-sm text-slate-400">{r.comment}</p>}
              </div>
              <div className="flex gap-2 shrink-0 h-fit">
                <button
                  disabled={busyId === r.id}
                  onClick={() => toggleHidden(r)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  {r.hidden ? 'Unhide' : 'Hide'}
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => remove(r)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
