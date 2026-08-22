'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AxonPartner } from '../../lib/types';

const rowInput = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function AxonPartnersPage() {
  const { show } = useToast();
  const [partners, setPartners] = useState<AxonPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [revealedKey, setRevealedKey] = useState<{ partnerName: string; key: string } | null>(null);

  function load() {
    setLoading(true);
    adminApi.axonPartners().then((res) => setPartners(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !companyName.trim() || !contactEmail.trim()) {
      show('Provide a name, company name, and contact email', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await adminApi.createAxonPartner({ name: name.trim(), companyName: companyName.trim(), contactEmail: contactEmail.trim() });
      setRevealedKey({ partnerName: res.data.name, key: res.data.apiKey! });
      setName(''); setCompanyName(''); setContactEmail('');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to create partner', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Axon Partners" subtitle={`${partners.length} partners · B2B fleet-aggregator integrations`}>
      {revealedKey && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-amber-300 mb-1">API key for {revealedKey.partnerName}</h2>
          <p className="text-xs text-amber-200/80 mb-3">
            This is shown once and never again — copy it now and share it with the partner over a secure channel.
          </p>
          <code className="block bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-100 font-mono break-all">
            {revealedKey.key}
          </code>
          <button onClick={() => setRevealedKey(null)} className="mt-3 text-xs font-semibold text-amber-300 hover:text-amber-200">
            I've copied it — dismiss
          </button>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-slate-100 mb-4">Add a Partner</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Contact Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={`${rowInput} w-full`} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Company</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Zoomcar" className={`${rowInput} w-full`} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Contact Email</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="ops@zoomcar.com" className={`${rowInput} w-full`} />
          </div>
          <button type="submit" disabled={busy} className="col-span-full sm:col-span-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">
            Create Partner
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : partners.length === 0 ? (
        <p className="text-slate-500">No Axon partners yet.</p>
      ) : (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Bookings</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Since</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-3 px-4 font-semibold text-slate-200">{p.companyName}</td>
                  <td className="py-3 px-4 text-slate-400">{p.name} · {p.contactEmail}</td>
                  <td className="py-3 px-4 text-slate-400">{p.bookingCount}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
