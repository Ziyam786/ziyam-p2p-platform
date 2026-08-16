'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminCar } from '../../lib/types';

const CATEGORIES = ['Hatchback', 'Sedan', 'SUV', 'Luxury', 'EV', 'MUV'];
const FUEL_TYPES = ['PETROL', 'DIESEL', 'EV'];
const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC'];

type EditForm = {
  make: string; model: string; year: string; category: string; fuelType: string; transmission: string; seats: string;
  city: string; address: string; dailyRate: string; securityDeposit: string; kmIncludedPerDay: string; extraKmCharge: string;
  description: string; features: string; instantBook: boolean;
  offersDelivery: boolean; deliveryFee: string; offersPickup: boolean; pickupFee: string;
};

function toForm(c: AdminCar): EditForm {
  return {
    make: c.make, model: c.model, year: String(c.year), category: c.category, fuelType: c.fuelType,
    transmission: c.transmission, seats: String(c.seats), city: c.city, address: c.address ?? '',
    dailyRate: String(c.dailyRate), securityDeposit: String(c.securityDeposit),
    kmIncludedPerDay: String(c.kmIncludedPerDay), extraKmCharge: String(c.extraKmCharge),
    description: c.description ?? '', features: (c.features ?? []).join(', '), instantBook: c.instantBook,
    offersDelivery: c.offersDelivery, deliveryFee: String(c.deliveryFee), offersPickup: c.offersPickup, pickupFee: String(c.pickupFee),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function CarsPage() {
  const { show } = useToast();
  const [cars, setCars] = useState<AdminCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCar | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    adminApi.cars().then((res) => setCars(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openEdit(c: AdminCar) {
    setEditing(c);
    setForm(toForm(c));
  }

  async function saveEdit() {
    if (!editing || !form) return;
    setSaving(true);
    try {
      await adminApi.updateCar(editing.id, {
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        category: form.category,
        fuelType: form.fuelType,
        transmission: form.transmission,
        seats: Number(form.seats),
        city: form.city.trim(),
        address: form.address.trim() || undefined,
        dailyRate: Number(form.dailyRate),
        securityDeposit: Number(form.securityDeposit),
        kmIncludedPerDay: Number(form.kmIncludedPerDay),
        extraKmCharge: Number(form.extraKmCharge),
        description: form.description.trim() || undefined,
        features: form.features.split(',').map((f) => f.trim()).filter(Boolean),
        instantBook: form.instantBook,
        offersDelivery: form.offersDelivery,
        deliveryFee: Number(form.deliveryFee),
        offersPickup: form.offersPickup,
        pickupFee: Number(form.pickupFee),
      });
      show('Listing updated', 'success');
      setEditing(null);
      setForm(null);
      load();
    } catch (err: any) {
      show(err.message ?? 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFeatured(c: AdminCar) {
    setBusyId(c.id);
    try {
      await adminApi.updateCar(c.id, { featured: !c.featured });
      show(c.featured ? 'Removed from featured' : 'Featured on homepage', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAvailable(c: AdminCar) {
    setBusyId(c.id);
    try {
      await adminApi.updateCar(c.id, { isAvailable: !c.isAvailable });
      show(c.isAvailable ? 'Listing delisted' : 'Listing reactivated', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function approveGoLive(c: AdminCar) {
    if (!confirm(`Confirm the Fleet Partner Agreement has actually been signed with the owner of ${c.make} ${c.model}? This makes the car fleet-managed and live immediately.`)) return;
    setBusyId(c.id);
    try {
      await adminApi.approveFleetGoLive(c.id);
      show('Car is now fleet-managed and live', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell title="Cars" subtitle={`${cars.length} listings across all hosts`}>
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4">Car</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4">Rate</th>
                <th className="py-3 px-4">Bookings</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((c) => (
                <tr key={c.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-3 px-4 font-medium text-slate-200">{c.make} {c.model} <span className="text-slate-500 text-xs">({c.registrationNo})</span></td>
                  <td className="py-3 px-4 text-slate-400">{c.owner?.fullName ?? '—'}</td>
                  <td className="py-3 px-4 text-slate-400">{c.city}</td>
                  <td className="py-3 px-4 text-slate-400">₹{c.dailyRate.toLocaleString()}/day</td>
                  <td className="py-3 px-4 text-slate-400">{c._count?.bookings ?? 0}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.isAvailable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {c.isAvailable ? 'Live' : 'Delisted'}
                    </span>
                  </td>
                  <td className="py-3 px-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                    >
                      Edit
                    </button>
                    <button
                      disabled={busyId === c.id}
                      onClick={() => toggleFeatured(c)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                        c.featured ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {c.featured ? '★ Featured' : '☆ Feature'}
                    </button>
                    <button
                      disabled={busyId === c.id}
                      onClick={() => toggleAvailable(c)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                        c.isAvailable ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {c.isAvailable ? 'Delist' : 'Relist'}
                    </button>
                    {!c.fleetManaged && c.fleetOnboardingStep >= 2 && (
                      <button
                        disabled={busyId === c.id}
                        onClick={() => approveGoLive(c)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition"
                        title="Confirms the Fleet Partner Agreement was signed and makes this car fleet-managed"
                      >
                        Approve Go-Live
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(editing && form)} onClose={() => { setEditing(null); setForm(null); }} title={editing ? `Edit ${editing.make} ${editing.model} (${editing.registrationNo})` : 'Edit car'}>
        {form && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Make"><input className={inputCls} value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></Field>
              <Field label="Model"><input className={inputCls} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
              <Field label="Year"><input type="number" className={inputCls} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
              <Field label="Seats"><input type="number" className={inputCls} value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></Field>
              <Field label="Category">
                <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Fuel Type">
                <select className={inputCls} value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })}>
                  {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Transmission">
                <select className={inputCls} value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })}>
                  {TRANSMISSIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Instant Book">
                <select className={inputCls} value={form.instantBook ? '1' : '0'} onChange={(e) => setForm({ ...form, instantBook: e.target.value === '1' })}>
                  <option value="1">Enabled</option>
                  <option value="0">Disabled</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="Address"><input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Daily Rate (₹)"><input type="number" className={inputCls} value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} /></Field>
              <Field label="Security Deposit (₹)"><input type="number" className={inputCls} value={form.securityDeposit} onChange={(e) => setForm({ ...form, securityDeposit: e.target.value })} /></Field>
              <Field label="Km Included / Day"><input type="number" className={inputCls} value={form.kmIncludedPerDay} onChange={(e) => setForm({ ...form, kmIncludedPerDay: e.target.value })} /></Field>
              <Field label="Extra Km Charge (₹)"><input type="number" className={inputCls} value={form.extraKmCharge} onChange={(e) => setForm({ ...form, extraKmCharge: e.target.value })} /></Field>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <Field label="Offers Delivery">
                <select className={inputCls} value={form.offersDelivery ? '1' : '0'} onChange={(e) => setForm({ ...form, offersDelivery: e.target.value === '1' })}>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </Field>
              <Field label="Delivery Fee (₹)"><input type="number" disabled={!form.offersDelivery} className={`${inputCls} disabled:opacity-40`} value={form.deliveryFee} onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })} /></Field>
              <Field label="Offers Pickup">
                <select className={inputCls} value={form.offersPickup ? '1' : '0'} onChange={(e) => setForm({ ...form, offersPickup: e.target.value === '1' })}>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </Field>
              <Field label="Pickup Fee (₹)"><input type="number" disabled={!form.offersPickup} className={`${inputCls} disabled:opacity-40`} value={form.pickupFee} onChange={(e) => setForm({ ...form, pickupFee: e.target.value })} /></Field>
            </div>

            <Field label="Features (comma-separated)">
              <input className={inputCls} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="Sunroof, Bluetooth, Reverse Camera" />
            </Field>

            <Field label="Description">
              <textarea className={`${inputCls} min-h-[80px]`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>

            <p className="text-xs text-slate-500">Registration number, images, and documents aren't editable here — those go through the host's own listing flow. This form covers the fields admins most commonly need to correct.</p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button onClick={() => { setEditing(null); setForm(null); }} className="text-sm font-semibold px-4 py-2 rounded-lg text-slate-400 hover:text-white transition">Cancel</button>
              <button disabled={saving} onClick={saveEdit} className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AdminShell>
  );
}
