'use client';

import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { useToast } from './Toast';
import { carsApi } from '../lib/api';
import type { Blackout, Car } from '../lib/types';

export default function BlackoutManager({ car, onClose }: { car: Car; onClose: () => void }) {
  const { show } = useToast();
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    carsApi.blackouts(car.id).then((res) => setBlackouts(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [car.id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setSubmitting(true);
    try {
      await carsApi.addBlackout(car.id, { startDate, endDate, reason: reason || undefined });
      show('Dates blocked', 'success');
      setStartDate('');
      setEndDate('');
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
        Block off dates when this car isn't available (maintenance, personal use, etc.). Renters won't be able to book overlapping dates.
      </p>

      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3 mb-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">From</label>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">To</label>
          <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reason (optional)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Servicing" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <button type="submit" disabled={submitting} className="col-span-2 btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-2.5 rounded-xl transition text-sm">
          {submitting ? 'Blocking…' : 'Block These Dates'}
        </button>
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
