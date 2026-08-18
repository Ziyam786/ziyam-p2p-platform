'use client';

import React, { useEffect, useState } from 'react';
import { carsApi, damageClaimApi, uploadsApi } from '../lib/api';
import { useToast } from './Toast';
import type { Booking, Car, DamageClaim, TripIssueType } from '../lib/types';

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
  BILL_SUBMITTED: 'bg-purple-50 text-purple-600',
  APPROVED: 'bg-red-50 text-red-600',
  REJECTED: 'bg-emerald-50 text-emerald-600',
};

const TYPE_LABELS: Record<TripIssueType, string> = { DAMAGE: 'Damage', FUEL: 'Fuel', FASTAG: 'FASTag' };

export default function DamageClaimPanel({ car }: { car: Car }) {
  const { show } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportingFor, setReportingFor] = useState<Booking | null>(null);
  const [billingFor, setBillingFor] = useState<DamageClaim | null>(null);

  function load() {
    carsApi
      .bookings(car.id)
      .then((res) => setBookings(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [car.id]);

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;

  const completed = bookings.filter((b) => b.status === 'COMPLETED');
  const billableStatuses = ['SUBMITTED', 'UNDER_REVIEW'];

  return (
    <div className="space-y-6">
      {reportingFor && (
        <ReportIssueForm
          booking={reportingFor}
          onClose={() => setReportingFor(null)}
          onSubmitted={() => {
            setReportingFor(null);
            load();
          }}
        />
      )}
      {billingFor && (
        <SubmitBillForm
          claim={billingFor}
          onClose={() => setBillingFor(null)}
          onSubmitted={() => {
            setBillingFor(null);
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
              const reports = b.damageClaims ?? [];
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

                  {reports.map((claim) => (
                    <div key={claim.id} className="mt-2 flex items-center justify-between text-xs border-t border-gray-50 pt-2">
                      <span className="text-gray-500">
                        {TYPE_LABELS[claim.type]}: ₹{claim.estimatedCost.toLocaleString('en-IN')} estimated
                        {claim.approvedDeduction != null && ` · ₹${claim.approvedDeduction.toLocaleString('en-IN')} approved`}
                      </span>
                      <div className="flex items-center gap-2">
                        {billableStatuses.includes(claim.status) && claim.type === 'DAMAGE' && (
                          <button onClick={() => setBillingFor(claim)} className="font-bold text-purple-600 hover:text-purple-700">
                            Submit Repair Bill
                          </button>
                        )}
                        <span className={`font-bold px-2 py-0.5 rounded-full ${CLAIM_STATUS_STYLES[claim.status]}`}>{claim.status.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  ))}

                  {withinWindow ? (
                    <button onClick={() => setReportingFor(b)} className="mt-2 text-xs font-bold text-red-600 hover:text-red-700">
                      Report an Issue
                    </button>
                  ) : reports.length === 0 ? (
                    <p className="mt-2 text-xs text-gray-400">Report window closed ({REPORT_WINDOW_HOURS}h after trip end)</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportIssueForm({ booking, onClose, onSubmitted }: { booking: Booking; onClose: () => void; onSubmitted: () => void }) {
  const { show } = useToast();
  const [type, setType] = useState<TripIssueType>('DAMAGE');
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
      await damageClaimApi.report(booking.id, { type, description: description.trim(), estimatedCost: cost, images });
      show('Issue reported — our team will review it', 'success');
      onSubmitted();
    } catch (err: any) {
      show(err.message ?? 'Failed to submit report', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-red-200 bg-red-50 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-bold text-gray-900">Report an Issue — {booking.customer?.fullName ?? 'this trip'}</p>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Cancel</button>
      </div>
      <p className="text-xs text-gray-500">
        Deducted from the ₹{booking.depositAmount.toLocaleString('en-IN')} held deposit once approved. If the approved
        amount is more than the deposit covers, the guest is charged the difference directly through the app.
      </p>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Issue type</label>
        <div className="flex gap-2">
          {(['DAMAGE', 'FUEL', 'FASTAG'] as TripIssueType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition ${type === t ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">What happened</label>
        <textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={type === 'DAMAGE' ? 'e.g. Deep scratch on rear bumper, discovered at drop-off' : type === 'FUEL' ? 'e.g. Returned with less fuel than at pickup' : 'e.g. FASTag balance not topped up as agreed'}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Estimated cost (₹)</label>
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
        {busy ? 'Submitting…' : 'Submit Report'}
      </button>
    </form>
  );
}

function SubmitBillForm({ claim, onClose, onSubmitted }: { claim: DamageClaim; onClose: () => void; onSubmitted: () => void }) {
  const { show } = useToast();
  const [billFile, setBillFile] = useState<string>('');
  const [billAmount, setBillAmount] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleBillFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadsApi.upload(file);
      setBillFile(url);
    } catch (err: any) {
      show(err.message ?? 'Upload failed', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadsApi.upload(file);
      setPhotos((prev) => [...prev, url]);
    } catch (err: any) {
      show(err.message ?? 'Upload failed', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(billAmount);
    if (!billFile || !amount || amount <= 0) return;
    setBusy(true);
    try {
      await damageClaimApi.submitBill(claim.id, { billUrl: billFile, billAmount: amount, photos });
      show('Repair bill submitted for review', 'success');
      onSubmitted();
    } catch (err: any) {
      show(err.message ?? 'Failed to submit bill', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-purple-200 bg-purple-50 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-bold text-gray-900">Submit Repair Bill</p>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Cancel</button>
      </div>
      <p className="text-xs text-gray-500">
        Once approved, your reimbursement is paid out fast — this is real evidence, not the original estimate.
      </p>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Repair bill / invoice</label>
        <input type="file" accept="image/*,.pdf" onChange={handleBillFile} disabled={uploading} className="text-xs" />
        {billFile && <p className="text-xs text-emerald-600 mt-1">✓ Uploaded</p>}
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Actual repair cost (₹)</label>
        <input
          required
          type="number"
          min={1}
          value={billAmount}
          onChange={(e) => setBillAmount(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Repair photos (optional)</label>
        <input type="file" accept="image/*" onChange={handlePhotoFile} disabled={uploading} className="text-xs" />
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
            ))}
          </div>
        )}
      </div>
      <button disabled={busy || uploading || !billFile} type="submit" className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-xl transition text-sm">
        {busy ? 'Submitting…' : 'Submit Bill'}
      </button>
    </form>
  );
}
