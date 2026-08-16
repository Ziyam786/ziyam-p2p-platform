'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useToast } from '../../../components/Toast';
import { carsApi, opsTripApi, ApiError } from '../../../lib/api';
import type { AgentCar } from '../../../lib/types';

const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function isValidMobile(mobile: string) {
  return /^[6-9]\d{9}$/.test(mobile.trim());
}

function NewCheckInInner() {
  const router = useRouter();
  const { show } = useToast();

  const [cars, setCars] = useState<AgentCar[]>([]);
  const [carsLoading, setCarsLoading] = useState(true);

  const [carId, setCarId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [odometerStart, setOdometerStart] = useState('');
  const [baseFare, setBaseFare] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [notes, setNotes] = useState('');

  const [vaultChecking, setVaultChecking] = useState(false);
  const [vaultFound, setVaultFound] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    carsApi.list().then((res) => setCars(res.data)).finally(() => setCarsLoading(false));
  }, []);

  const selectedCar = cars.find((c) => c.id === carId);

  function handleCarChange(id: string) {
    setCarId(id);
    const car = cars.find((c) => c.id === id);
    if (car) {
      setDepositAmount(String(car.securityDeposit ?? ''));
      setBaseFare(String(car.dailyRate ?? ''));
    }
  }

  async function handleMobileBlur() {
    setVaultFound(false);
    if (!isValidMobile(customerMobile)) return;
    setVaultChecking(true);
    try {
      await opsTripApi.vaultLookup(customerMobile.trim());
      setVaultFound(true);
    } catch (err) {
      // 404 (no vault entry) is expected and silently ignored; other errors are non-fatal here too.
    } finally {
      setVaultChecking(false);
    }
  }

  const canSubmit = Boolean(carId) && customerName.trim().length > 0 && isValidMobile(customerMobile) && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await opsTripApi.checkIn({
        carId,
        customerName: customerName.trim(),
        customerMobile: customerMobile.trim(),
        startTime: new Date().toISOString(),
        pickupLocation: pickupLocation.trim() || undefined,
        odometerStart: odometerStart ? Number(odometerStart) : undefined,
        baseFare: baseFare ? Number(baseFare) : undefined,
        depositAmount: depositAmount ? Number(depositAmount) : undefined,
        notes: notes.trim() || undefined,
      });
      show('Trip checked in', 'success');
      router.push(`/bookings/${res.data.id}`);
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to check in', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-10">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center gap-3">
        <Link href="/" className="text-slate-400 hover:text-white text-xl leading-none" aria-label="Back">←</Link>
        <div>
          <h1 className="font-extrabold text-lg">New Check-In</h1>
          <p className="text-xs text-slate-500">Start a new trip for a walk-in customer</p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Vehicle">
            <select
              value={carId}
              onChange={(e) => handleCarChange(e.target.value)}
              className={inputCls}
              required
              disabled={carsLoading}
            >
              <option value="">{carsLoading ? 'Loading vehicles…' : 'Select vehicle…'}</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>{c.make} {c.model} · {c.registrationNo}</option>
              ))}
            </select>
            {selectedCar && (
              <p className="text-xs text-slate-500 mt-1">
                ₹{selectedCar.dailyRate.toLocaleString('en-IN')}/day · {selectedCar.kmIncludedPerDay} km/day included
              </p>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4">
            <Field label="Customer Name">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputCls} required placeholder="Full name" />
            </Field>
            <Field label="Customer Mobile">
              <input
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onBlur={handleMobileBlur}
                className={inputCls}
                required
                inputMode="numeric"
                placeholder="10-digit mobile number"
              />
              {customerMobile.length > 0 && !isValidMobile(customerMobile) && (
                <p className="text-xs text-amber-400 mt-1">Enter a valid 10-digit mobile number</p>
              )}
              {vaultChecking && <p className="text-xs text-slate-500 mt-1">Checking saved records…</p>}
              {vaultFound && <p className="text-xs text-emerald-400 mt-1">✓ Returning customer — saved ID on file</p>}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Pickup Location">
              <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} className={inputCls} placeholder="Optional" />
            </Field>
            <Field label="Odometer Start (km)">
              <input type="number" min={0} value={odometerStart} onChange={(e) => setOdometerStart(e.target.value)} className={inputCls} placeholder="Optional" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Base Fare (₹)">
              <input type="number" min={0} value={baseFare} onChange={(e) => setBaseFare(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Deposit Amount (₹)">
              <input type="number" min={0} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} placeholder="Optional" />
          </Field>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl transition"
          >
            {submitting ? 'Checking in…' : 'Check In & Start Trip'}
          </button>
        </form>
      </main>
    </div>
  );
}

export default function NewCheckInPage() {
  return (
    <ProtectedRoute>
      <NewCheckInInner />
    </ProtectedRoute>
  );
}
