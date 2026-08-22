'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import Modal from '../../components/Modal';
import BookingDetailModal from '../../components/BookingDetailModal';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminBooking, AdminCar, AdminUser, BookingStatus } from '../../lib/types';

// Client-side buckets over one unfiltered fetch, rather than a separate
// route/page per status — matches every other resource in this admin app
// (cars/users/etc. are all single list pages), just with a tab bar instead
// of a dropdown so the granular BharatCars-style buckets are one click away.
const TABS: { key: string; label: string; statuses: BookingStatus[] | null }[] = [
  { key: 'upcoming', label: 'Upcoming', statuses: ['PENDING', 'PENDING_PAYMENT', 'RESERVED', 'PENDING_HOST_REVIEW', 'CONFIRMED'] },
  { key: 'ongoing', label: 'Ongoing', statuses: ['ACTIVE'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'rejected', label: 'Rejected', statuses: ['REJECTED'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED'] },
  { key: 'all', label: 'All', statuses: null },
];
const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookingsPage() {
  const { show } = useToast();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AdminBooking | null>(null);

  function load() {
    setLoading(true);
    adminApi.bookings().then((res) => setBookings(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
  const filtered = activeTab.statuses ? bookings.filter((b) => activeTab.statuses!.includes(b.status)) : bookings;

  async function forceCancel(b: AdminBooking) {
    if (!confirm(`Force-cancel this booking for ${b.car?.make} ${b.car?.model}?`)) return;
    setBusyId(b.id);
    try {
      await adminApi.updateBooking(b.id, 'CANCELLED');
      show('Booking cancelled', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  // ── Create Booking ──────────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<'WALK_IN' | 'ADVANCE'>('WALK_IN');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<AdminUser[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [cars, setCars] = useState<AdminCar[]>([]);
  const [carId, setCarId] = useState('');
  const [startTime, setStartTime] = useState(toLocalInput(new Date()));
  const [endTime, setEndTime] = useState(toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [protectionPlan, setProtectionPlan] = useState('BASIC');
  const [totalAmount, setTotalAmount] = useState('');
  const [amountTouched, setAmountTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedCar = cars.find((c) => c.id === carId);

  const estimatedAmount = useMemo(() => {
    if (!selectedCar) return 0;
    const ms = new Date(endTime).getTime() - new Date(startTime).getTime();
    const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    return days * selectedCar.dailyRate;
  }, [selectedCar, startTime, endTime]);

  useEffect(() => {
    if (!amountTouched) setTotalAmount(String(estimatedAmount || ''));
  }, [estimatedAmount, amountTouched]);

  function openCreate() {
    setCreating(true);
    setMode('WALK_IN');
    setCustomerMode('new');
    setCustomerSearch('');
    setSelectedCustomerId('');
    setNewCustomer({ name: '', phone: '', email: '' });
    setCarId('');
    const now = new Date();
    setStartTime(toLocalInput(now));
    setEndTime(toLocalInput(new Date(now.getTime() + 24 * 60 * 60 * 1000)));
    setProtectionPlan('BASIC');
    setTotalAmount('');
    setAmountTouched(false);
    if (cars.length === 0) adminApi.cars().then((res) => setCars(res.data.filter((c) => c.isAvailable)));
    if (customers.length === 0) adminApi.users().then((res) => setCustomers(res.data));
  }

  const filteredCustomers = customerSearch.trim()
    ? customers.filter((u) =>
        u.fullName.toLowerCase().includes(customerSearch.toLowerCase()) ||
        u.phoneNumber.includes(customerSearch) ||
        u.email.toLowerCase().includes(customerSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  async function submitCreate() {
    if (!carId) return show('Select a car', 'error');
    if (customerMode === 'existing' && !selectedCustomerId) return show('Select a customer', 'error');
    if (customerMode === 'new' && (!newCustomer.name.trim() || !newCustomer.phone.trim() || !newCustomer.email.trim())) {
      return show('Name, phone, and email are required for a new customer', 'error');
    }
    if (!totalAmount || Number(totalAmount) <= 0) return show('Enter a valid total amount', 'error');

    setSubmitting(true);
    try {
      await adminApi.createBooking({
        ...(customerMode === 'existing'
          ? { customerId: selectedCustomerId }
          : { customerName: newCustomer.name.trim(), customerPhone: newCustomer.phone.trim(), customerEmail: newCustomer.email.trim() }),
        carId,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        totalAmount: Number(totalAmount),
        protectionPlan,
        status: mode === 'WALK_IN' ? 'ACTIVE' : 'CONFIRMED',
      });
      show('Booking created', 'success');
      setCreating(false);
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to create booking', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminShell
      title="Bookings"
      subtitle={`${filtered.length} of ${bookings.length} bookings`}
      action={
        <button onClick={openCreate} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition">
          + Create Booking
        </button>
      }
    >
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs font-semibold px-3.5 py-2 rounded-lg transition ${tab === t.key ? 'bg-brand-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4">Car</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const refund = b.refundRequests?.[0];
                return (
                  <tr key={b.id} className="border-b border-slate-800/60 last:border-0">
                    <td className="py-3 px-4 font-medium text-slate-200">
                      {b.car?.make} {b.car?.model} <span className="text-slate-500 text-xs">({b.car?.city})</span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {b.source === 'AXON_PARTNER' ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="bg-sky-500/10 text-sky-300 text-[10px] font-bold px-2 py-0.5 rounded-full">AXON</span>
                          {b.axonPartner?.companyName ?? 'Partner'}
                        </span>
                      ) : (
                        b.customer?.fullName ?? '—'
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {new Date(b.startTime).toLocaleDateString()} → {new Date(b.endTime).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-slate-400">₹{b.totalAmount.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-800 px-2 py-1 rounded-full text-xs">{b.status}</span>
                      {b.status === 'ACTIVE' && (
                        <span
                          className={`ml-1.5 px-2 py-1 rounded-full text-xs font-semibold ${
                            new Date(b.endTime).getTime() < Date.now() ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}
                        >
                          {new Date(b.endTime).getTime() < Date.now() ? '⚠ Return overdue' : '✓ On track'}
                        </span>
                      )}
                      {(tab === 'rejected' || tab === 'cancelled') && (
                        <p className="text-[11px] text-slate-500 mt-1 max-w-[220px]">
                          {(tab === 'rejected' ? b.rejectionReason : b.cancellationReason) ?? '—'}
                          {refund && ` · ₹${refund.amount.toLocaleString()} refund (${refund.status.toLowerCase()})`}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewing(b)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                        >
                          View
                        </button>
                        {['PENDING', 'PENDING_PAYMENT', 'RESERVED', 'PENDING_HOST_REVIEW', 'CONFIRMED', 'ACTIVE'].includes(b.status) && (
                          <button
                            disabled={busyId === b.id}
                            onClick={() => forceCancel(b)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition"
                          >
                            Force Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BookingDetailModal booking={viewing} onClose={() => setViewing(null)} />

      <Modal open={creating} onClose={() => setCreating(false)} title="Create Booking">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">Booking Type</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode('WALK_IN')} className={`text-sm font-semibold px-3 py-2.5 rounded-lg transition ${mode === 'WALK_IN' ? 'bg-brand-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-300'}`}>
                Walk-in (starts now)
              </button>
              <button onClick={() => setMode('ADVANCE')} className={`text-sm font-semibold px-3 py-2.5 rounded-lg transition ${mode === 'ADVANCE' ? 'bg-brand-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-300'}`}>
                Advance Booking
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-400">Customer</p>
              <button onClick={() => setCustomerMode(customerMode === 'new' ? 'existing' : 'new')} className="text-xs text-brand-400 hover:text-brand-300">
                {customerMode === 'new' ? 'Search existing instead' : 'Create new instead'}
              </button>
            </div>
            {customerMode === 'existing' ? (
              <div>
                <input className={inputCls} placeholder="Search by name, phone, or email" value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerId(''); }} />
                {filteredCustomers.length > 0 && !selectedCustomerId && (
                  <div className="mt-1 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                    {filteredCustomers.map((u) => (
                      <button key={u.id} onClick={() => { setSelectedCustomerId(u.id); setCustomerSearch(`${u.fullName} (${u.phoneNumber})`); }} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition">
                        {u.fullName} — {u.phoneNumber} — {u.email}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input className={inputCls} placeholder="Customer name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                <input className={inputCls} placeholder="Phone number" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                <input type="email" className={inputCls} placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                <p className="text-xs text-slate-500">This creates a real account for the customer, marked KYC-verified since you're confirming their identity in person.</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">Car</p>
            <select className={inputCls} value={carId} onChange={(e) => setCarId(e.target.value)}>
              <option value="">Select an available car…</option>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.make} {c.model} ({c.registrationNo}) — ₹{c.dailyRate}/day — {c.city}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-1">Start</p>
              <input type="datetime-local" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-1">End</p>
              <input type="datetime-local" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-1">Protection Plan</p>
              <select className={inputCls} value={protectionPlan} onChange={(e) => setProtectionPlan(e.target.value)}>
                <option value="BASIC">Basic</option>
                <option value="STANDARD">Standard</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-1">Total Amount (₹)</p>
              <input type="number" className={inputCls} value={totalAmount} onChange={(e) => { setTotalAmount(e.target.value); setAmountTouched(true); }} />
              {selectedCar && <p className="text-xs text-slate-500 mt-1">Suggested: ₹{estimatedAmount.toLocaleString()} (editable)</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button onClick={() => setCreating(false)} className="text-sm font-semibold px-4 py-2 rounded-lg text-slate-400 hover:text-white transition">Cancel</button>
            <button disabled={submitting} onClick={submitCreate} className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition">
              {submitting ? 'Creating…' : 'Create Booking'}
            </button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
