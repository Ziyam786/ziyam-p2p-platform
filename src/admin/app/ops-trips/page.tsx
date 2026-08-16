'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { adminApi, opsTripApi } from '../../lib/api';
import type { AdminCar, OpsTripRow, OpsTripStatus } from '../../lib/types';

const rowInput = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full';

// Ground-truthed exact status vocabulary + colors from the real production dashboard.
const STATUS_STYLES: Record<OpsTripStatus, string> = {
  SCHEDULED: 'bg-amber-500/10 text-amber-400',
  RUNNING: 'bg-blue-500/10 text-blue-400',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
};

function inr(n?: number | null) {
  return n == null ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function OpsTripsPage() {
  const { show } = useToast();
  const [cars, setCars] = useState<AdminCar[]>([]);
  const [trips, setTrips] = useState<OpsTripRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkoutTrip, setCheckoutTrip] = useState<OpsTripRow | null>(null);

  function load() {
    setLoading(true);
    opsTripApi.list({ status: statusFilter || undefined }).then((res) => setTrips(res.data)).finally(() => setLoading(false));
  }

  useEffect(() => {
    adminApi.cars().then((res) => setCars(res.data)).catch(() => {});
  }, []);

  useEffect(load, [statusFilter]);

  return (
    <AdminShell title="Ops Trips" subtitle="Trip check-in / check-out lifecycle — external-platform and walk-in bookings logged by ops staff">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 border-b border-slate-800">
          {['', 'RUNNING', 'SCHEDULED', 'COMPLETED', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${
                statusFilter === s ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {s === '' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCheckIn(true)} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition shrink-0">
          + New Trip / Check-In
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : trips.length === 0 ? (
        <p className="text-slate-500 text-center py-16">No trips {statusFilter ? `in status ${statusFilter}` : 'logged'} yet.</p>
      ) : (
        <div className="space-y-3">
          {trips.map((t) => (
            <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center gap-4">
              <img src={t.car?.images?.[0] ?? '/placeholder-car.jpg'} alt="" className="w-20 h-14 rounded-lg object-cover bg-slate-800 shrink-0" />
              <div className="flex-1 min-w-[220px]">
                <p className="font-bold text-slate-100">{t.car ? `${t.car.make} ${t.car.model}` : t.carId} <span className="text-slate-500 font-normal text-xs">{t.car?.registrationNo}</span></p>
                <p className="text-xs text-slate-400 mt-0.5">{t.customerName} · {t.customerMobile}{t.bookingPlatform ? ` · ${t.bookingPlatform}` : ''}</p>
                <p className="text-xs text-slate-500 mt-0.5">{new Date(t.startTime).toLocaleString()}{t.endTime ? ` → ${new Date(t.endTime).toLocaleString()}` : ''}</p>
              </div>
              <div className="text-right text-xs text-slate-400 shrink-0">
                <p>{inr(t.amount)}</p>
                {t.odometerStart != null && <p>Odo: {t.odometerStart}{t.odometerEnd != null ? ` → ${t.odometerEnd}` : ''}</p>}
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[t.status]}`}>{t.status}</span>
              <div className="flex gap-2 shrink-0">
                {t.status === 'RUNNING' && (
                  <button onClick={() => setCheckoutTrip(t)} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition">
                    Check Out
                  </button>
                )}
                {t.status === 'COMPLETED' && (
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await opsTripApi.generateInvoice(t.id);
                        window.location.href = `/invoices/${res.data.id}`;
                      } catch (err: any) {
                        show(err.message ?? 'Failed to generate invoice', 'error');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    Generate Invoice
                  </button>
                )}
                {(t.status === 'RUNNING' || t.status === 'SCHEDULED') && (
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (!confirm('Cancel this trip?')) return;
                      setBusy(true);
                      try { await opsTripApi.cancel(t.id); load(); } catch (err: any) { show(err.message ?? 'Failed to cancel', 'error'); } finally { setBusy(false); }
                    }}
                    className="text-xs font-semibold border border-slate-700 hover:border-red-500 text-slate-400 hover:text-red-400 px-4 py-2 rounded-lg transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCheckIn && <CheckInModal cars={cars} onClose={() => setShowCheckIn(false)} onDone={() => { setShowCheckIn(false); load(); }} show={show} />}
      {checkoutTrip && <CheckOutModal trip={checkoutTrip} onClose={() => setCheckoutTrip(null)} onDone={() => { setCheckoutTrip(null); load(); }} show={show} />}
    </AdminShell>
  );
}

function CheckInModal({ cars, onClose, onDone, show }: {
  cars: AdminCar[]; onClose: () => void; onDone: () => void; show: (m: string, t: 'success' | 'error') => void;
}) {
  const [carId, setCarId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [pickupType, setPickupType] = useState('Self Pickup');
  const [bookingPlatform, setBookingPlatform] = useState('');
  const [externalBookingId, setExternalBookingId] = useState('');
  const [startTime, setStartTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [odometerStart, setOdometerStart] = useState('');
  const [fastag, setFastag] = useState('');
  const [baseFare, setBaseFare] = useState('');
  const [addonTotal, setAddonTotal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedCar = cars.find((c) => c.id === carId);
  const carPaused = selectedCar?.fleetStatus === 'paused';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!carId || !customerName || !customerMobile) return show('Fill in Car, Customer Name, and Mobile', 'error');
    setSubmitting(true);
    try {
      await opsTripApi.checkIn({
        carId, customerName, customerMobile,
        pickupLocation: pickupLocation || undefined, dropLocation: dropLocation || undefined, pickupType,
        bookingPlatform: bookingPlatform || undefined, externalBookingId: externalBookingId || undefined,
        startTime: new Date(startTime).toISOString(),
        odometerStart: odometerStart ? Number(odometerStart) : undefined,
        fastag: fastag || undefined,
        baseFare: baseFare ? Number(baseFare) : undefined,
        addonTotal: addonTotal ? Number(addonTotal) : undefined,
      });
      show('Trip checked in', 'success');
      onDone();
    } catch (err: any) {
      show(err.message ?? 'Failed to check in', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New Trip — Check-In">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Vehicle">
          <select value={carId} onChange={(e) => setCarId(e.target.value)} className={rowInput} required>
            <option value="">Select vehicle…</option>
            {cars.map((c) => <option key={c.id} value={c.id}>{c.make} {c.model} · {c.registrationNo}</option>)}
          </select>
        </Field>
        {carPaused && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            ⚠ This vehicle is currently paused ({selectedCar?.pauseReason ?? 'reason not set'}) — check-in will be rejected.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer Name"><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={rowInput} required /></Field>
          <Field label="Customer Mobile"><input value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} className={rowInput} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pickup Location"><input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} className={rowInput} /></Field>
          <Field label="Drop Location"><input value={dropLocation} onChange={(e) => setDropLocation(e.target.value)} className={rowInput} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pickup Type">
            <select value={pickupType} onChange={(e) => setPickupType(e.target.value)} className={rowInput}>
              {['Self Pickup', 'Doorstep', 'Airport Pickup', 'Airport Drop'].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Start Date & Time"><input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={rowInput} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Booking Platform (optional)"><input value={bookingPlatform} onChange={(e) => setBookingPlatform(e.target.value)} placeholder="Zoomcar, Revv, Bharat, Direct…" className={rowInput} /></Field>
          <Field label="External Booking ID"><input value={externalBookingId} onChange={(e) => setExternalBookingId(e.target.value)} className={rowInput} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Odometer Start (km)"><input type="number" min={0} value={odometerStart} onChange={(e) => setOdometerStart(e.target.value)} className={rowInput} /></Field>
          <Field label="FASTag Balance"><input value={fastag} onChange={(e) => setFastag(e.target.value)} className={rowInput} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Base Fare (₹)"><input type="number" min={0} value={baseFare} onChange={(e) => setBaseFare(e.target.value)} className={rowInput} /></Field>
          <Field label="Addon Total (₹)"><input type="number" min={0} value={addonTotal} onChange={(e) => setAddonTotal(e.target.value)} className={rowInput} /></Field>
        </div>
        <button type="submit" disabled={submitting || carPaused} className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold py-2.5 rounded-lg transition">
          {submitting ? 'Checking in…' : 'Check In & Start Trip'}
        </button>
      </form>
    </Modal>
  );
}

function CheckOutModal({ trip, onClose, onDone, show }: {
  trip: OpsTripRow; onClose: () => void; onDone: () => void; show: (m: string, t: 'success' | 'error') => void;
}) {
  const [odometerEnd, setOdometerEnd] = useState('');
  const [checkoutFastag, setCheckoutFastag] = useState('');
  const [fuelEst, setFuelEst] = useState('');
  const [carWashed, setCarWashed] = useState(false);
  const [washingCharges, setWashingCharges] = useState('');
  const [tyreHealth, setTyreHealth] = useState('');
  const [newDamages, setNewDamages] = useState('');
  const [amountCollected, setAmountCollected] = useState('');
  const [amountPaidGuest, setAmountPaidGuest] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await opsTripApi.checkOut(trip.id, {
        odometerEnd: odometerEnd ? Number(odometerEnd) : undefined,
        checkoutFastag: checkoutFastag || undefined,
        fuelEst: fuelEst || undefined,
        carWashed,
        washingCharges: washingCharges ? Number(washingCharges) : undefined,
        tyreHealth: tyreHealth || undefined,
        newDamages: newDamages || undefined,
        amountCollected: amountCollected ? Number(amountCollected) : undefined,
        amountPaidGuest: amountPaidGuest ? Number(amountPaidGuest) : undefined,
      });
      show('Trip checked out', 'success');
      onDone();
    } catch (err: any) {
      show(err.message ?? 'Failed to check out', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Check-Out — ${trip.car?.make} ${trip.car?.model}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500">
          {trip.customerName} · {trip.customerMobile}{trip.odometerStart != null ? ` · Picked up at ${trip.odometerStart} km` : ''}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Odometer End (km)"><input type="number" min={0} value={odometerEnd} onChange={(e) => setOdometerEnd(e.target.value)} className={rowInput} /></Field>
          <Field label="FASTag Balance"><input value={checkoutFastag} onChange={(e) => setCheckoutFastag(e.target.value)} className={rowInput} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fuel Estimate"><input value={fuelEst} onChange={(e) => setFuelEst(e.target.value)} placeholder="e.g. Full, 3/4, 1/2" className={rowInput} /></Field>
          <Field label="Tyre Health"><input value={tyreHealth} onChange={(e) => setTyreHealth(e.target.value)} placeholder="Good / Needs Attention" className={rowInput} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={carWashed} onChange={(e) => setCarWashed(e.target.checked)} className="w-4 h-4 accent-brand-500" />
          Car washed at return
        </label>
        {carWashed && (
          <Field label="Washing Charges (₹)"><input type="number" min={0} value={washingCharges} onChange={(e) => setWashingCharges(e.target.value)} className={rowInput} /></Field>
        )}
        <Field label="New Damages (notes)"><textarea value={newDamages} onChange={(e) => setNewDamages(e.target.value)} rows={2} className={rowInput} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount Collected (₹)"><input type="number" min={0} value={amountCollected} onChange={(e) => setAmountCollected(e.target.value)} className={rowInput} /></Field>
          <Field label="Amount Paid to Guest (₹)"><input type="number" min={0} value={amountPaidGuest} onChange={(e) => setAmountPaidGuest(e.target.value)} placeholder="e.g. deposit refund" className={rowInput} /></Field>
        </div>
        <button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-bold py-2.5 rounded-lg transition">
          {submitting ? 'Completing…' : 'Complete Check-Out'}
        </button>
      </form>
    </Modal>
  );
}
