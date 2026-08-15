'use client';

import React, { useEffect, useState } from 'react';
import { serviceApi } from '../lib/api';
import { useToast } from './Toast';
import type { Car, ServiceCatalogEntry, ServiceRequest } from '../lib/types';

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: 'bg-amber-50 text-amber-600',
  CONFIRMED: 'bg-blue-50 text-blue-600',
  COMPLETED: 'bg-emerald-50 text-emerald-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function VehicleServices({ car }: { car: Car }) {
  const { show } = useToast();
  const [catalog, setCatalog] = useState<ServiceCatalogEntry[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<ServiceCatalogEntry | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [serviceLocation, setServiceLocation] = useState(car.address ?? car.city);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    Promise.all([serviceApi.catalog(), serviceApi.list(car.id)])
      .then(([c, r]) => {
        setCatalog(c.data);
        setRequests(r.data);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [car.id]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!booking || !scheduledDate || !serviceLocation) return;
    setBusy(true);
    try {
      await serviceApi.create({
        carId: car.id,
        serviceType: booking.serviceType,
        priceEstimate: booking.priceFrom,
        scheduledDate,
        serviceLocation,
        notes: notes || undefined,
      });
      show('Service booked', 'success');
      setBooking(null);
      setScheduledDate('');
      setNotes('');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to book service', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(request: ServiceRequest, status: string) {
    setBusy(true);
    try {
      await serviceApi.updateStatus(request.id, status);
      show(status === 'COMPLETED' ? 'Marked complete — logged to Fleet Ledger' : 'Updated', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to update', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div className="space-y-6">
      {booking ? (
        <form onSubmit={handleBook} className="border border-amber-200 bg-amber-50 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-gray-900">{booking.serviceType}</p>
            <button type="button" onClick={() => setBooking(null)} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Cancel</button>
          </div>
          <p className="text-xs text-gray-500">Price from ₹{booking.priceFrom.toLocaleString('en-IN')} — final charges depend on inspection.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Service Date">
              <input required type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Service Location">
              <input required value={serviceLocation} onChange={(e) => setServiceLocation(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. AC not cooling" className={inputCls} />
          </Field>
          <button disabled={busy} type="submit" className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-2.5 rounded-xl transition text-sm">
            {busy ? 'Booking…' : 'Confirm Booking'}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          {catalog.map((entry) => (
            <div key={entry.serviceType} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-gray-900 text-sm">{entry.serviceType}</p>
                <span className="text-xs font-semibold text-gray-500">From ₹{entry.priceFrom.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">{entry.description}</p>
              <button onClick={() => setBooking(entry)} className="text-xs font-bold bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg transition">
                Book This Service
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-2">Service History</h3>
        {requests.length === 0 ? (
          <p className="text-xs text-gray-400">No services booked yet.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{r.serviceType}</p>
                  <p className="text-xs text-gray-400">{new Date(r.scheduledDate).toLocaleString()} · {r.serviceLocation}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                  {(r.status === 'REQUESTED' || r.status === 'CONFIRMED') && (
                    <button disabled={busy} onClick={() => handleStatusChange(r, 'COMPLETED')} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}
