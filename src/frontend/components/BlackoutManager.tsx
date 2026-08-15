'use client';

import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import PauseCalendar from './PauseCalendar';
import { useToast } from './Toast';
import { carsApi } from '../lib/api';
import type { Blackout, Car } from '../lib/types';

export default function BlackoutManager({ car, onClose }: { car: Car; onClose: () => void }) {
  const { show } = useToast();
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    carsApi.blackouts(car.id).then((res) => setBlackouts(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [car.id]);

  function handlePickDate(iso: string) {
    if (!startDate || (startDate && endDate)) {
      setStartDate(iso);
      setEndDate(null);
      return;
    }
    if (iso < startDate) {
      setStartDate(iso);
      return;
    }
    setEndDate(iso);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setSubmitting(true);
    try {
      await carsApi.addBlackout(car.id, { startDate, endDate, reason: reason || undefined });
      show('Dates blocked', 'success');
      setStartDate(null);
      setEndDate(null);
      setReason('');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to block dates', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await carsApi.deleteBlackout(id);
      setBlackouts((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      show(err.message ?? 'Failed to remove', 'error');
    }
  }

  return (
    <Modal open onClose={onClose} title={`Availability — ${car.make} ${car.model}`}>
      <p className="text-sm text-gray-500 mb-4">
        Tap a start date, then an end date, to pause bookings for that range (maintenance, personal use, etc.). Renters won't be able to book overlapping dates.
      </p>

      <form onSubmit={handleAdd} className="mb-6">
        <PauseCalendar blackouts={blackouts} rangeStart={startDate} rangeEnd={endDate} onPickDate={handlePickDate} />
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Selected:</span>
            <span className="font-semibold text-gray-800">
              {startDate ? new Date(startDate).toLocaleDateString() : '—'} → {endDate ? new Date(endDate).toLocaleDateString() : '—'}
            </span>
          </div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional) — e.g. Servicing" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          <button type="submit" disabled={submitting || !startDate || !endDate} className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-2.5 rounded-xl transition text-sm">
            {submitting ? 'Blocking…' : 'Block These Dates'}
          </button>
        </div>
      </form>

      <h3 className="text-sm font-bold text-gray-900 mb-2">Blocked Ranges</h3>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : blackouts.length === 0 ? (
        <p className="text-sm text-gray-400">No blocked dates yet.</p>
      ) : (
        <div className="space-y-2">
          {blackouts.map((b) => (
            <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <div>
                <span className="text-gray-800 font-medium">
                  {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()}
                </span>
                {b.reason && <span className="text-gray-400 text-xs ml-2">({b.reason})</span>}
              </div>
              <button onClick={() => handleDelete(b.id)} className="text-red-400 hover:text-red-500 text-xs font-semibold">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
