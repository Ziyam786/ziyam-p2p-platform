'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { agentApi, adminApi, opsTripApi } from '../../lib/api';
import type { AgentServiceRequest, OpsTripCheckInPayload } from '../../lib/api';
import type { AdminUser, AdminCar, OpsTripRow } from '../../lib/types';

const TRIP_STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-amber-500/10 text-amber-400',
  RUNNING: 'bg-blue-500/10 text-blue-400',
};

const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: 'bg-amber-500/10 text-amber-400',
  CONFIRMED: 'bg-blue-500/10 text-blue-400',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
};

function AgentPortalInner() {
  const { user, logout } = useAuth();
  const { show } = useToast();
  const [jobs, setJobs] = useState<AgentServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    agentApi.queue().then((res) => setJobs(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  const isAdmin = user?.role === 'ADMIN';
  const [agents, setAgents] = useState<AdminUser[]>([]);
  useEffect(() => {
    if (isAdmin) adminApi.users('AGENT').then((res) => setAgents(res.data)).catch(() => {});
  }, [isAdmin]);

  // Quick trip check-in/out — the ground-staff "handover" workflow, kept
  // deliberately minimal (car + customer name + phone) so it's fast on a
  // phone at the curb. Full reconciliation (odometer, fastag, damages)
  // still happens later in the desktop Ops Trips admin page.
  const [cars, setCars] = useState<AdminCar[]>([]);
  const [trips, setTrips] = useState<OpsTripRow[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInForm, setCheckInForm] = useState({ carId: '', customerName: '', customerMobile: '' });
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkoutBusyId, setCheckoutBusyId] = useState<string | null>(null);

  function loadTrips() {
    setTripsLoading(true);
    opsTripApi.list({}).then((res) => setTrips(res.data.filter((t: any) => t.status === 'RUNNING' || t.status === 'SCHEDULED'))).finally(() => setTripsLoading(false));
  }

  useEffect(() => {
    adminApi.cars().then((res) => setCars(res.data)).catch(() => {});
    loadTrips();
  }, []);

  async function submitCheckIn() {
    if (!checkInForm.carId || !checkInForm.customerName || !checkInForm.customerMobile) {
      show('Car, customer name, and phone are required', 'error');
      return;
    }
    setCheckInBusy(true);
    try {
      const payload: OpsTripCheckInPayload = {
        carId: checkInForm.carId,
        customerName: checkInForm.customerName,
        customerMobile: checkInForm.customerMobile,
        startTime: new Date().toISOString(),
      };
      await opsTripApi.checkIn(payload);
      show('Trip checked in', 'success');
      setShowCheckIn(false);
      setCheckInForm({ carId: '', customerName: '', customerMobile: '' });
      loadTrips();
    } catch (err: any) {
      show(err.message ?? 'Check-in failed', 'error');
    } finally {
      setCheckInBusy(false);
    }
  }

  async function quickCheckOut(tripId: string) {
    setCheckoutBusyId(tripId);
    try {
      await opsTripApi.checkOut(tripId, { endTime: new Date().toISOString() });
      show('Trip checked out', 'success');
      loadTrips();
    } catch (err: any) {
      show(err.message ?? 'Check-out failed', 'error');
    } finally {
      setCheckoutBusyId(null);
    }
  }

  async function updateStatus(id: string, status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') {
    setBusyId(id);
    try {
      await agentApi.updateStatus(id, status);
      show(`Job marked ${status.toLowerCase()}`, 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to update job', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const [editing, setEditing] = useState<AgentServiceRequest | null>(null);
  const [editForm, setEditForm] = useState({ priceEstimate: '', scheduledDate: '', serviceLocation: '', notes: '', assignedAgentId: '' });
  const [saving, setSaving] = useState(false);

  function openEdit(job: AgentServiceRequest) {
    setEditing(job);
    setEditForm({
      priceEstimate: String(job.priceEstimate), scheduledDate: toLocalInput(job.scheduledDate),
      serviceLocation: job.serviceLocation, notes: job.notes ?? '', assignedAgentId: job.assignedAgentId ?? '',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await agentApi.update(editing.id, {
        priceEstimate: Number(editForm.priceEstimate),
        scheduledDate: new Date(editForm.scheduledDate).toISOString(),
        serviceLocation: editForm.serviceLocation,
        notes: editForm.notes || undefined,
        assignedAgentId: editForm.assignedAgentId || null,
      });
      show('Job updated', 'success');
      setEditing(null);
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to update job', 'error');
    } finally {
      setSaving(false);
    }
  }

  const openJobs = jobs.filter((j) => j.status === 'REQUESTED' || j.status === 'CONFIRMED');
  const doneJobs = jobs.filter((j) => j.status === 'COMPLETED' || j.status === 'CANCELLED');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-extrabold text-lg">Agent Portal</h1>
          <p className="text-xs text-slate-500">Signed in as {user?.fullName}</p>
        </div>
        <button onClick={() => logout()} className="text-xs font-semibold text-slate-400 hover:text-white">
          Sign out
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-300">My Trips ({trips.length})</h2>
          <button
            onClick={() => setShowCheckIn(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition"
          >
            + Quick Check-In
          </button>
        </div>
        {tripsLoading ? (
          <p className="text-slate-600 text-sm mb-10">Loading trips…</p>
        ) : trips.length === 0 ? (
          <p className="text-slate-600 text-sm mb-10">No active trips — check a customer in when they arrive.</p>
        ) : (
          <div className="space-y-3 mb-10">
            {trips.map((trip) => (
              <div key={trip.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{trip.car?.make} {trip.car?.model} <span className="text-slate-500 font-normal">· {trip.car?.registrationNo}</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">{trip.customerName} · {trip.customerMobile}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${TRIP_STATUS_STYLES[trip.status] ?? 'bg-slate-800 text-slate-400'}`}>{trip.status}</span>
                </div>
                {trip.status === 'RUNNING' && (
                  <button
                    disabled={checkoutBusyId === trip.id}
                    onClick={() => quickCheckOut(trip.id)}
                    className="mt-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                  >
                    {checkoutBusyId === trip.id ? 'Checking out…' : 'Check Out'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Loading your assignments…</p>
        ) : (
          <>
            <h2 className="text-sm font-bold text-slate-300 mb-3">Open Jobs ({openJobs.length})</h2>
            {openJobs.length === 0 ? (
              <p className="text-slate-600 text-sm mb-8">No open assignments right now.</p>
            ) : (
              <div className="space-y-3 mb-10">
                {openJobs.map((job) => (
                  <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{job.serviceType} — {job.car.make} {job.car.model}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{job.car.registrationNo} · {job.serviceLocation}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Requested by {job.requestedBy.fullName} · {job.requestedBy.phoneNumber}</p>
                        {job.notes && <p className="text-xs text-slate-400 mt-1">"{job.notes}"</p>}
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[job.status]}`}>{job.status}</span>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {isAdmin && (
                        <button
                          disabled={busyId === job.id}
                          onClick={() => openEdit(job)}
                          className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg transition disabled:opacity-50"
                        >
                          Edit / Reassign
                        </button>
                      )}
                      {job.status === 'REQUESTED' && (
                        <button
                          disabled={busyId === job.id}
                          onClick={() => updateStatus(job.id, 'CONFIRMED')}
                          className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                        >
                          Confirm
                        </button>
                      )}
                      {job.status === 'CONFIRMED' && (
                        <button
                          disabled={busyId === job.id}
                          onClick={() => updateStatus(job.id, 'COMPLETED')}
                          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                        >
                          Mark Completed
                        </button>
                      )}
                      <button
                        disabled={busyId === job.id}
                        onClick={() => updateStatus(job.id, 'CANCELLED')}
                        className="text-xs font-bold border border-slate-700 hover:border-red-500 text-slate-400 hover:text-red-400 px-4 py-2 rounded-lg transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-sm font-bold text-slate-300 mb-3">History ({doneJobs.length})</h2>
            {doneJobs.length === 0 ? (
              <p className="text-slate-600 text-sm">Nothing completed yet.</p>
            ) : (
              <div className="space-y-2">
                {doneJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm text-slate-300">{job.serviceType} — {job.car.make} {job.car.model}</p>
                      <p className="text-xs text-slate-500">{new Date(job.scheduledDate).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[job.status]}`}>{job.status}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Modal open={showCheckIn} onClose={() => setShowCheckIn(false)} title="Quick Check-In">
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Car</span>
            <select className={inputCls} value={checkInForm.carId} onChange={(e) => setCheckInForm({ ...checkInForm, carId: e.target.value })}>
              <option value="">Select a car</option>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.make} {c.model} — {c.registrationNo}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Customer Name</span>
            <input className={inputCls} value={checkInForm.customerName} onChange={(e) => setCheckInForm({ ...checkInForm, customerName: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Customer Mobile</span>
            <input className={inputCls} value={checkInForm.customerMobile} onChange={(e) => setCheckInForm({ ...checkInForm, customerMobile: e.target.value })} />
          </label>
          <p className="text-xs text-slate-500">Full trip details (odometer, fastag, fuel) can be filled in later from the desktop Ops Trips page — this just gets the handover started.</p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button onClick={() => setShowCheckIn(false)} className="text-sm font-semibold px-4 py-2 rounded-lg text-slate-400 hover:text-white transition">Cancel</button>
            <button disabled={checkInBusy} onClick={submitCheckIn} className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition">
              {checkInBusy ? 'Checking in…' : 'Check In'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Edit — ${editing.serviceType}` : 'Edit job'}>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Price Estimate (₹)</span>
            <input type="number" min={0} className={inputCls} value={editForm.priceEstimate} onChange={(e) => setEditForm({ ...editForm, priceEstimate: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Scheduled Date & Time</span>
            <input type="datetime-local" className={inputCls} value={editForm.scheduledDate} onChange={(e) => setEditForm({ ...editForm, scheduledDate: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Service Location</span>
            <input className={inputCls} value={editForm.serviceLocation} onChange={(e) => setEditForm({ ...editForm, serviceLocation: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Notes</span>
            <textarea className={`${inputCls} min-h-[70px]`} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Assigned Agent</span>
            <select className={inputCls} value={editForm.assignedAgentId} onChange={(e) => setEditForm({ ...editForm, assignedAgentId: e.target.value })}>
              <option value="">— Unassigned —</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.fullName} ({a.phoneNumber})</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button onClick={() => setEditing(null)} className="text-sm font-semibold px-4 py-2 rounded-lg text-slate-400 hover:text-white transition">Cancel</button>
            <button disabled={saving} onClick={saveEdit} className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function AgentPortalPage() {
  return (
    <ProtectedRoute>
      <AgentPortalInner />
    </ProtectedRoute>
  );
}
