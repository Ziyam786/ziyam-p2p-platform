'use client';

import React, { useEffect, useState } from 'react';
import { hostReviewApi, carsApi } from '../lib/api';
import { useToast } from './Toast';
import type { Booking } from '../lib/types';

// Values must match PAUSE_SUGGESTING_REASONS / the reason strings accepted in
// src/backend/routes/hostReview.routes.ts.
const REJECT_REASONS = [
  { value: 'VEHICLE_NOT_AVAILABLE', label: 'Vehicle Not Available' },
  { value: 'VEHICLE_UNDER_SERVICE', label: 'Vehicle Under Service' },
  { value: 'VEHICLE_BOOKED_ELSEWHERE', label: 'Vehicle Booked Elsewhere' },
  { value: 'Other', label: 'Other' },
];

function timeLeft(deadline?: string | null): string {
  if (!deadline) return '';
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'Expiring…';
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${mins}m left to respond` : `${mins}m left to respond`;
}

export default function BookingRequestsPanel({ onChanged }: { onChanged?: () => void }) {
  const { show } = useToast();
  const [requests, setRequests] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0].value);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pausePromptCarId, setPausePromptCarId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    hostReviewApi.requests().then((res) => setRequests(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function accept(booking: Booking) {
    setBusyId(booking.id);
    try {
      await hostReviewApi.decide(booking.id, { decision: 'ACCEPT' });
      show('Booking confirmed', 'success');
      setRequests((prev) => prev.filter((r) => r.id !== booking.id));
      onChanged?.();
    } catch (err: any) {
      show(err.message ?? 'Failed to accept', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(booking: Booking) {
    setBusyId(booking.id);
    try {
      const res = await hostReviewApi.decide(booking.id, { decision: 'REJECT', reason, note: note.trim() || undefined });
      show('Booking declined — guest fully refunded', 'success');
      setRequests((prev) => prev.filter((r) => r.id !== booking.id));
      setRejectingId(null);
      setNote('');
      onChanged?.();
      if (res.suggestPause) setPausePromptCarId(booking.carId);
    } catch (err: any) {
      show(err.message ?? 'Failed to reject', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function pauseListing(carId: string) {
    try {
      await carsApi.update(carId, { isAvailable: false });
      show('Listing paused', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to pause listing', 'error');
    } finally {
      setPausePromptCarId(null);
    }
  }

  if (loading) return <p className="text-gray-400">Loading booking requests…</p>;

  return (
    <div className="space-y-4">
      {pausePromptCarId && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-300">Pause this listing now so you don't get more requests for a car that isn't available?</p>
          <div className="flex gap-2">
            <button onClick={() => pauseListing(pausePromptCarId)} className="text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-950 px-4 py-2 rounded-lg transition whitespace-nowrap">
              Pause Listing
            </button>
            <button onClick={() => setPausePromptCarId(null)} className="text-xs font-semibold text-amber-300/70 hover:text-amber-300 px-2">
              Not now
            </button>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl">
          <p className="text-gray-400">No pending booking requests.</p>
        </div>
      ) : (
        requests.map((r) => (
          <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="font-bold">{r.car?.make} {r.car?.model} <span className="text-gray-500 font-normal text-sm">— {r.customer?.fullName}</span></p>
                <p className="text-xs text-gray-400">
                  {new Date(r.startTime).toLocaleString()} → {new Date(r.endTime).toLocaleString()}
                </p>
                <div className="flex gap-1.5 mt-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.customer?.isKycVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {r.customer?.isKycVerified ? '✓ KYC' : '✗ KYC'}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.customer?.isDrivingLicenseVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {r.customer?.isDrivingLicenseVerified ? '✓ License' : '✗ License'}
                  </span>
                  {r.customer?.isSelfieVerified && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">✓ Identity Match</span>
                  )}
                </div>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 whitespace-nowrap">
                {timeLeft(r.hostReviewDeadline)}
              </span>
            </div>

            {rejectingId === r.id ? (
              <div className="border border-gray-800 rounded-lg p-4 space-y-3 bg-gray-950">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reason</label>
                  <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                    {REJECT_REASONS.map((r2) => <option key={r2.value} value={r2.value}>{r2.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Note (optional)</label>
                  <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
                </div>
                <p className="text-xs text-gray-500">The guest is fully refunded automatically — no cancellation charge applies to a host decline.</p>
                <div className="flex gap-2">
                  <button onClick={() => setRejectingId(null)} className="text-xs font-semibold border border-gray-700 text-gray-300 px-4 py-2 rounded-lg">Cancel</button>
                  <button disabled={busyId === r.id} onClick={() => reject(r)} className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition">
                    Confirm Decline
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button disabled={busyId === r.id} onClick={() => accept(r)} className="text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-gray-950 px-4 py-2 rounded-lg transition">
                  Accept
                </button>
                <button disabled={busyId === r.id} onClick={() => setRejectingId(r.id)} className="text-xs font-semibold border border-gray-700 hover:border-red-500 text-gray-300 hover:text-red-400 px-4 py-2 rounded-lg transition">
                  Decline
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
