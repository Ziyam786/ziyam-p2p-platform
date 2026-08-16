'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { agentApi, adminApi } from '../../lib/api';
import type { AgentServiceRequest } from '../../lib/api';
import type { AdminUser } from '../../lib/types';

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
