'use client';

import React, { useEffect, useState } from 'react';
import { carsApi, damageClaimApi, uploadsApi } from '../lib/api';
import { useToast } from './Toast';
import type { Booking, Car } from '../lib/types';

// Matches REPORT_WINDOW_HOURS in src/backend/routes/damageClaim.routes.ts —
// kept in sync manually since frontend/backend don't share constants.
const REPORT_WINDOW_HOURS = 24;

const DEPOSIT_STATUS_STYLES: Record<string, string> = {
  HELD: 'bg-amber-50 text-amber-600',
  RELEASED: 'bg-emerald-50 text-emerald-600',
  PARTIALLY_DEDUCTED: 'bg-orange-50 text-orange-600',
  FORFEITED: 'bg-red-50 text-red-600',
};

const CLAIM_STATUS_STYLES: Record<string, string> = {
  SUBMITTED: 'bg-amber-50 text-amber-600',
  UNDER_REVIEW: 'bg-blue-50 text-blue-600',
  APPROVED: 'bg-red-50 text-red-600',
  REJECTED: 'bg-emerald-50 text-emerald-600',
};

export default function DamageClaimPanel({ car }: { car: Car }) {
  const { show } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportingFor, setReportingFor] = useState<Booking | null>(null);

  function load() {
    carsApi
      .bookings(car.id)
      .then((res) => setBookings(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [car.id]);

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;

  const completed = bookings.filter((b) => b.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      {reportingFor && (
        <ReportDamageForm
          booking={reportingFor}
          onClose={() => setReportingFor(null)}
          onSubmitted={() => {
            setReportingFor(null);
            load();
          }}
        />
      )}

      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-2">Trip History & Deposit Status</h3>
        {completed.length === 0 ? (
          <p className="text-xs text-gray-400">No completed trips yet.</p>
        ) : (
          <div className="space-y-2">
            {completed.map((b) => {
              const deadline = new Date(new Date(b.endTime).getTime() + REPORT_WINDOW_HOURS * 60 * 60 * 1000);
              const withinWindow = new Date() <= deadline;
              return (
                <div key={b.id} className="border border-gray-100 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{b.customer?.fullName ?? 'Guest'}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(b.startTime).toLocaleDateString()} – {new Date(b.endTime).toLocaleDateString()} · Deposit ₹{b.depositAmount.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${DEPOSIT_STATUS_STYLES[b.depositStatus]}`}>
                      {b.depositStatus.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {b.damageClaim ? (
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        Damage claim: ₹{b.damageClaim.estimatedCost.toLocaleString('en-IN')} estimated
                        {b.damageClaim.approvedDeduction != null && ` · ₹${b.damageClaim.approvedDeduction.toLocaleString('en-IN')} approved`}
                      </span>
                      <span className={`font-bold px-2 py-0.5 rounded-full ${CLAIM_STATUS_STYLES[b.damageClaim.status]}`}>{b.damageClaim.status}</span>
                    </div>
                  ) : withinWindow ? (
                    <button onClick={() => setReportingFor(b)} className="mt-2 text-xs font-bold text-red-600 hover:text-red-700">
                      Report Damage
                    </button>
                  ) : (
                    <p className="mt-2 text-xs text-gray-400">Report window closed ({REPORT_WINDOW_HOURS}h after trip end)</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportDamageForm({ booking, onClose, onSubmitted }: { booking: Booking; onClose: () => void; onSubmitted: () => void }) {
  const { show } = useToast();
  const [description, setDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadsApi.upload(file);
      setImages((prev) => [...prev, url]);
    } catch (err: any) {
      show(err.message ?? 'Photo upload failed', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cost = Number(estimatedCost);
    if (!description.trim() || !cost || cost <= 0) return;
    setBusy(true);
    try {
      await damageClaimApi.report(booking.id, { description: description.trim(), estimatedCost: cost, images });
      show('Damage claim submitted — our team will review it', 'success');
      onSubmitted();
    } catch (err: any) {
      show(err.message ?? 'Failed to submit claim', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-red-200 bg-red-50 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-bold text-gray-900">Report Damage — {booking.customer?.fullName ?? 'this trip'}</p>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Cancel</button>
      </div>
      <p className="text-xs text-gray-500">
        Deducted from the ₹{booking.depositAmount.toLocaleString('en-IN')} held deposit once approved. Costs beyond the
        deposit are yours to recover directly from the lessee — see the Host Policy.
      </p>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">What happened</label>
        <textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="e.g. Deep scratch on rear bumper, discovered at drop-off"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Estimated repair cost (₹)</label>
        <input
          required
          type="number"
          min={1}
          value={estimatedCost}
          onChange={(e) => setEstimatedCost(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Photos</label>
        <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="text-xs" />
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {images.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
            ))}
          </div>
        )}
      </div>
      <button disabled={busy || uploading} type="submit" className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-xl transition text-sm">
        {busy ? 'Submitting…' : 'Submit Claim'}
      </button>
    </form>
  );
}
