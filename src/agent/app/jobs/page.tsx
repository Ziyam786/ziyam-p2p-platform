'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import BottomNav from '../../components/BottomNav';
import { useToast } from '../../components/Toast';
import { agentApi, openWhatsApp, ApiError } from '../../lib/api';
import type { AgentServiceRequest } from '../../lib/types';

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: 'bg-amber-500/10 text-amber-400',
  CONFIRMED: 'bg-blue-500/10 text-blue-400',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
};

function JobsInner() {
  const { show } = useToast();
  const [jobs, setJobs] = useState<AgentServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    agentApi
      .queue()
      .then((res) => setJobs(res.data))
      .catch((err) => show(err instanceof ApiError ? err.message : 'Failed to load jobs', 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function updateStatus(id: string, status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') {
    setBusyId(id);
    try {
      await agentApi.updateStatus(id, status);
      show(`Job marked ${status.toLowerCase()}`, 'success');
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to update job', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const openJobs = jobs.filter((j) => j.status === 'REQUESTED' || j.status === 'CONFIRMED');
  const doneJobs = jobs.filter((j) => j.status === 'COMPLETED' || j.status === 'CANCELLED');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="border-b border-slate-800 px-4 py-4">
        <h1 className="font-extrabold text-lg">Assigned jobs</h1>
        <p className="text-xs text-slate-500">Washing, damages, and other services routed to you</p>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-8">
        {loading ? (
          <p className="text-slate-600 text-sm">Loading jobs…</p>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-bold text-slate-300 mb-3">Open ({openJobs.length})</h2>
              {openJobs.length === 0 ? (
                <p className="text-slate-600 text-sm">No open wash or service jobs right now.</p>
              ) : (
                <div className="space-y-3">
                  {openJobs.map((job) => (
                    <JobCard key={job.id} job={job} busy={busyId === job.id} onUpdate={updateStatus} />
                  ))}
                </div>
              )}
            </section>
            {doneJobs.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-slate-300 mb-3">Closed ({doneJobs.length})</h2>
                <div className="space-y-3">
                  {doneJobs.map((job) => (
                    <JobCard key={job.id} job={job} busy={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function JobCard({
  job,
  busy,
  onUpdate,
}: {
  job: AgentServiceRequest;
  busy: boolean;
  onUpdate?: (id: string, status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED') => void;
}) {
  const when = new Date(job.scheduledDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const liveBooking = job.booking?.status === 'ACTIVE' && job.booking.liveLatitude != null && job.booking.liveLongitude != null ? job.booking : null;
  const liveAgeMin = liveBooking?.liveLocationUpdatedAt
    ? Math.max(0, Math.round((Date.now() - new Date(liveBooking.liveLocationUpdatedAt).getTime()) / 60000))
    : null;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-sm">{job.serviceType}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {job.car.make} {job.car.model} · {job.car.registrationNo}
          </p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[job.status]}`}>{job.status}</span>
      </div>
      <p className="text-xs text-slate-500">
        {when} · {job.serviceLocation} · ₹{job.priceEstimate.toLocaleString('en-IN')}
      </p>
      <p className="text-xs text-slate-400">
        Requested by {job.requestedBy.fullName} · {job.requestedBy.phoneNumber}
      </p>
      {job.notes && <p className="text-xs text-slate-500">{job.notes}</p>}
      {liveBooking && (
        <p className="text-xs">
          <span className="text-emerald-400 font-semibold">🛰 Trip in progress</span>
          <span className="text-slate-500">{liveAgeMin != null ? ` · updated ${liveAgeMin}m ago` : ''} · </span>
          <a
            href={`https://www.google.com/maps?q=${liveBooking.liveLatitude},${liveBooking.liveLongitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:text-brand-300 font-semibold"
          >
            Locate car ↗
          </a>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openWhatsApp(job.requestedBy.phoneNumber, `Hi ${job.requestedBy.fullName}, this is Ziyam regarding your ${job.serviceType.toLowerCase()} job for ${job.car.registrationNo}.`)}
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
        >
          WhatsApp guest
        </button>
        {onUpdate && job.status === 'REQUESTED' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate(job.id, 'CONFIRMED')}
            className="text-xs font-bold bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
          >
            Accept
          </button>
        )}
        {onUpdate && (job.status === 'REQUESTED' || job.status === 'CONFIRMED') && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate(job.id, 'COMPLETED')}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
            >
              Complete
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate(job.id, 'CANCELLED')}
              className="text-xs font-semibold text-red-400 hover:text-red-300"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function JobsPage() {
  return (
    <ProtectedRoute>
      <JobsInner />
    </ProtectedRoute>
  );
}
