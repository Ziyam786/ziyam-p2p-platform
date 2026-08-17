'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { PromoCode } from '../../lib/types';

const rowInput = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function PromoCodesPage() {
  const { show } = useToast();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountFlat, setDiscountFlat] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  function load() {
    setLoading(true);
    adminApi.promoCodes().then((res) => setCodes(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || (!discountPercent && !discountFlat)) {
      show('Provide a code and either a percent or flat discount', 'error');
      return;
    }
    setBusy(true);
    try {
      await adminApi.createPromoCode({
        code: code.trim(),
        discountPercent: discountPercent ? Number(discountPercent) / 100 : undefined,
        discountFlat: discountFlat ? Number(discountFlat) : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
        expiresAt: expiresAt || undefined,
      });
      show('Promo code created', 'success');
      setCode(''); setDiscountPercent(''); setDiscountFlat(''); setMaxUses(''); setExpiresAt('');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to create promo code', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p: PromoCode) {
    setBusy(true);
    try {
      await adminApi.togglePromoCode(p.code, !p.active);
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: PromoCode) {
    if (!confirm(`Delete promo code ${p.code}?`)) return;
    setBusy(true);
    try {
      await adminApi.deletePromoCode(p.code);
      show('Promo code deleted', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to delete', 'error');
    } finally {
      setBusy(false);
    }
  }

  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [editForm, setEditForm] = useState({ discountPercent: '', discountFlat: '', maxUses: '', expiresAt: '' });

  function openEdit(p: PromoCode) {
    setEditing(p);
    setEditForm({
      discountPercent: p.discountPercent ? String(Math.round(p.discountPercent * 100)) : '',
      discountFlat: p.discountFlat ? String(p.discountFlat) : '',
      maxUses: p.maxUses ? String(p.maxUses) : '',
      expiresAt: p.expiresAt ? p.expiresAt.slice(0, 10) : '',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await adminApi.updatePromoCode(editing.code, {
        discountPercent: editForm.discountPercent ? Number(editForm.discountPercent) / 100 : null,
        discountFlat: editForm.discountFlat ? Number(editForm.discountFlat) : null,
        maxUses: editForm.maxUses ? Number(editForm.maxUses) : null,
        expiresAt: editForm.expiresAt || null,
      });
      show('Promo code updated', 'success');
      setEditing(null);
      load();
    } catch (err: any) {
      show(err.message ?? 'Update failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Promo Codes" subtitle={`${codes.length} codes · lessees apply these at checkout`}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-slate-100 mb-4">Create a Promo Code</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ZIYAM10" className={`${rowInput} w-full`} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">% Off</label>
            <input type="number" min={0} max={100} value={discountPercent} onChange={(e) => { setDiscountPercent(e.target.value); setDiscountFlat(''); }} placeholder="10" className={`${rowInput} w-full`} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">or ₹ Flat Off</label>
            <input type="number" min={0} value={discountFlat} onChange={(e) => { setDiscountFlat(e.target.value); setDiscountPercent(''); }} placeholder="500" className={`${rowInput} w-full`} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Max Uses</label>
            <input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Unlimited" className={`${rowInput} w-full`} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Expires</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={`${rowInput} w-full`} />
          </div>
          <button type="submit" disabled={busy} className="col-span-2 sm:col-span-5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">
            Create Code
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="text-slate-500">No promo codes yet.</p>
      ) : (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Discount</th>
                <th className="py-3 px-4">Uses</th>
                <th className="py-3 px-4">Expires</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((p) => (
                <tr key={p.code} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-3 px-4 font-mono font-bold text-slate-200">{p.code}</td>
                  <td className="py-3 px-4 text-slate-400">
                    {p.discountPercent ? `${Math.round(p.discountPercent * 100)}%` : `₹${p.discountFlat}`}
                  </td>
                  <td className="py-3 px-4 text-slate-400">{p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ''}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : 'Never'}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      {p.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="py-3 px-4 flex gap-2">
                    <button disabled={busy} onClick={() => openEdit(p)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition">
                      Edit
                    </button>
                    <button disabled={busy} onClick={() => toggle(p)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition">
                      {p.active ? 'Disable' : 'Enable'}
                    </button>
                    <button disabled={busy} onClick={() => remove(p)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.code}` : 'Edit promo code'}>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">The code itself can't be changed once created — delete and recreate if you need a different code. Usage count ({editing?.usedCount ?? 0} so far) is preserved by editing in place instead.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-400 mb-1 block">% Off</span>
              <input type="number" min={0} max={100} className={`${rowInput} w-full`} value={editForm.discountPercent} onChange={(e) => setEditForm({ ...editForm, discountPercent: e.target.value, discountFlat: '' })} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-400 mb-1 block">or ₹ Flat Off</span>
              <input type="number" min={0} className={`${rowInput} w-full`} value={editForm.discountFlat} onChange={(e) => setEditForm({ ...editForm, discountFlat: e.target.value, discountPercent: '' })} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-400 mb-1 block">Max Uses</span>
              <input type="number" min={1} className={`${rowInput} w-full`} value={editForm.maxUses} onChange={(e) => setEditForm({ ...editForm, maxUses: e.target.value })} placeholder="Unlimited" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-400 mb-1 block">Expires</span>
              <input type="date" className={`${rowInput} w-full`} value={editForm.expiresAt} onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button onClick={() => setEditing(null)} className="text-sm font-semibold px-4 py-2 rounded-lg text-slate-400 hover:text-white transition">Cancel</button>
            <button disabled={busy} onClick={saveEdit} className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition">
              {busy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}
