'use client';

import React, { useState } from 'react';
import { carsApi } from '../lib/api';
import { useToast } from './Toast';
import type { Car } from '../lib/types';

const INTER_BOOKING_OPTIONS = [2, 3, 4, 5];
const MIN_DURATION_OPTIONS = [4, 8, 16, 24];
const MAX_DURATION_OPTIONS = [7, 14, 30, 60];

export default function BookingPreferences({ car, onUpdated }: { car: Car; onUpdated: (car: Car) => void }) {
  const { show } = useToast();
  const [values, setValues] = useState({
    noNightBookings: car.noNightBookings,
    minInterBookingHours: car.minInterBookingHours,
    minBookingHours: car.minBookingHours,
    maxBookingDays: car.maxBookingDays,
    offersDelivery: car.offersDelivery,
    deliveryFee: car.deliveryFee,
    offersPickup: car.offersPickup,
    pickupFee: car.pickupFee,
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof values>(key: K, val: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await carsApi.update(car.id, values);
      onUpdated(res.data);
      show('Booking preferences saved', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to save preferences', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border border-gray-100 rounded-xl p-4">
        <div>
          <p className="text-sm font-bold text-gray-800">No Night Bookings</p>
          <p className="text-xs text-gray-500">Time slot ({car.nightBookingStart} – {car.nightBookingEnd})</p>
        </div>
        <Toggle checked={values.noNightBookings} onChange={(v) => set('noNightBookings', v)} />
      </div>

      <div className="border border-gray-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-800">Door-Step Pickup</p>
          <Toggle checked={values.offersPickup} onChange={(v) => set('offersPickup', v)} />
        </div>
        {values.offersPickup && (
          <Field label="Pickup Fee (₹)">
            <input type="number" min={0} value={values.pickupFee} onChange={(e) => set('pickupFee', Number(e.target.value))} className={inputCls} />
          </Field>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <p className="text-sm font-bold text-gray-800">Door-Step Delivery</p>
          <Toggle checked={values.offersDelivery} onChange={(v) => set('offersDelivery', v)} />
        </div>
        {values.offersDelivery && (
          <Field label="Delivery Fee (₹)">
            <input type="number" min={0} value={values.deliveryFee} onChange={(e) => set('deliveryFee', Number(e.target.value))} className={inputCls} />
          </Field>
        )}
      </div>

      <div className="border border-gray-100 rounded-xl p-4">
        <p className="text-sm font-bold text-gray-800 mb-1">Minimum Inter-Booking Time</p>
        <p className="text-xs text-gray-500 mb-3">Buffer time between two bookings, in hours</p>
        <ChipRow options={INTER_BOOKING_OPTIONS} value={values.minInterBookingHours} onChange={(v) => set('minInterBookingHours', v)} />
      </div>

      <div className="border border-gray-100 rounded-xl p-4">
        <p className="text-sm font-bold text-gray-800 mb-1">Minimum Booking Duration</p>
        <p className="text-xs text-gray-500 mb-3">Shortest booking this car will accept, in hours</p>
        <ChipRow options={MIN_DURATION_OPTIONS} value={values.minBookingHours} onChange={(v) => set('minBookingHours', v)} />
      </div>

      <div className="border border-gray-100 rounded-xl p-4">
        <p className="text-sm font-bold text-gray-800 mb-1">Maximum Booking Duration</p>
        <p className="text-xs text-gray-500 mb-3">Longest booking this car will accept, in days</p>
        <ChipRow options={MAX_DURATION_OPTIONS} value={values.maxBookingDays} onChange={(v) => set('maxBookingDays', v)} />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
      >
        {saving ? 'Saving…' : 'Save Preferences'}
      </button>
    </div>
  );
}

function ChipRow({ options, value, onChange }: { options: number[]; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
            value === opt ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition relative shrink-0 ${checked ? 'bg-emerald-500' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${checked ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 max-w-[200px]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}
