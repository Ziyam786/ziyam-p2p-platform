'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminUser, CustomRoleRow, KycVerificationLogRow, Role } from '../../lib/types';

const ROLES: Role[] = [
  'CUSTOMER', 'SELF_HOST', 'FLEET_OPERATOR', 'AGENT',
  'FLEET_ADMIN', 'OPERATIONS_EXECUTIVE', 'MECHANICAL_EXECUTIVE', 'TECHNICIAN',
  'ADMIN',
];

// Roles governed by the Team & Access "Who Can Do What" permission layer —
// only these get a custom-role assignment control, since it's a no-op for
// everyone else (see requirePermission()'s CUSTOM_ROLE_GOVERNED list).
const CUSTOM_ROLE_ELIGIBLE: Role[] = ['FLEET_ADMIN', 'OPERATIONS_EXECUTIVE', 'MECHANICAL_EXECUTIVE', 'TECHNICIAN', 'AGENT'];

const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

/** Which of the three KYC paths (see kyc.routes.ts) actually produced this user's verified state. */
function kycMethod(u: AdminUser): { label: string; trust: 'high' | 'low' | 'none' } {
  if (u.digilockerStatus === 'authenticated') return { label: 'DigiLocker (government-backed)', trust: 'high' };
  if (u.aadhaarVerifiedName) return { label: 'Aadhaar OTP via Sandbox (government-backed)', trust: 'high' };
  if (u.kycDocUrl) return { label: 'Legacy document upload (no automated check)', trust: 'low' };
  return { label: 'No verification on file', trust: 'none' };
}

export default function UsersPage() {
  const { show } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [kycUser, setKycUser] = useState<AdminUser | null>(null);
  const [kycLog, setKycLog] = useState<KycVerificationLogRow[]>([]);

  useEffect(() => {
    if (!kycUser) return;
    setKycLog([]);
    adminApi.kycLog(kycUser.id).then((res) => setKycLog(res.data)).catch(() => {});
  }, [kycUser?.id]);

  function load() {
    setLoading(true);
    adminApi.users(roleFilter || undefined).then((res) => setUsers(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [roleFilter]);
  useEffect(() => { adminApi.customRoles().then((res) => setCustomRoles(res.data)).catch(() => {}); }, []);

  function openEdit(u: AdminUser) {
    setEditing(u);
    setForm({ fullName: u.fullName, email: u.email, phoneNumber: u.phoneNumber, bio: u.bio ?? '' });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await adminApi.updateUser(editing.id, {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        bio: form.bio.trim() || undefined,
      });
      show('Profile updated', 'success');
      setEditing(null);
      load();
    } catch (err: any) {
      show(err.message ?? 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleSuspend(u: AdminUser) {
    setBusyId(u.id);
    try {
      await adminApi.updateUser(u.id, { isSuspended: !u.isSuspended });
      show(u.isSuspended ? 'User reactivated' : 'User suspended', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleKyc(u: AdminUser) {
    setBusyId(u.id);
    try {
      await adminApi.updateUser(u.id, { isKycVerified: !u.isKycVerified });
      show(u.isKycVerified ? 'KYC reset to unverified' : 'KYC verified', 'success');
      load();
      setKycUser(null);
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(u: AdminUser, role: Role) {
    if (role === u.role) return;
    setBusyId(u.id);
    try {
      await adminApi.updateUser(u.id, { role });
      show(`Role changed to ${role}`, 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function changeCustomRole(u: AdminUser, customRoleId: string) {
    setBusyId(u.id);
    try {
      await adminApi.updateUser(u.id, { customRoleId: customRoleId || null });
      show(customRoleId ? 'Custom role assigned' : 'Custom role removed', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      title="Users"
      subtitle={`${users.length} accounts`}
      action={
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      }
    >
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Custom Role</th>
                <th className="py-3 px-4">KYC</th>
                <th className="py-3 px-4">License</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-3 px-4 font-medium text-slate-200">{u.fullName}</td>
                  <td className="py-3 px-4 text-slate-400">{u.email}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      disabled={busyId === u.id}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    {CUSTOM_ROLE_ELIGIBLE.includes(u.role) ? (
                      <select
                        value={u.customRoleId ?? ''}
                        disabled={busyId === u.id}
                        onChange={(e) => changeCustomRole(u, e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 max-w-[140px]"
                      >
                        <option value="">— None —</option>
                        {customRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => setKycUser(u)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.isKycVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {u.isKycVerified ? 'Verified' : 'Unverified'}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.isDrivingLicenseVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      {u.isDrivingLicenseVerified ? (u.isSelfieVerified ? 'Verified + ID Match' : 'Verified') : 'Unverified'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.isSuspended ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {u.isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td className="py-3 px-4 flex gap-2">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                    >
                      Edit
                    </button>
                    <button
                      disabled={busyId === u.id}
                      onClick={() => toggleSuspend(u)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                        u.isSuspended ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      {u.isSuspended ? 'Reactivate' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.fullName}` : 'Edit user'}>
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Full name</span>
            <input className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Email</span>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Phone number</span>
            <input className={inputCls} value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 mb-1 block">Bio</span>
            <textarea className={`${inputCls} min-h-[70px]`} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </label>
          <p className="text-xs text-slate-500">Email and phone are unique per account — if the new value is already in use elsewhere, saving will fail with a clear error rather than silently overwriting anything.</p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button onClick={() => setEditing(null)} className="text-sm font-semibold px-4 py-2 rounded-lg text-slate-400 hover:text-white transition">Cancel</button>
            <button disabled={saving} onClick={saveEdit} className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(kycUser)} onClose={() => setKycUser(null)} title={kycUser ? `KYC — ${kycUser.fullName}` : 'KYC'}>
        {kycUser && (() => {
          const method = kycMethod(kycUser);
          const nameMismatch = kycUser.aadhaarVerifiedName && kycUser.aadhaarVerifiedName.trim().toLowerCase() !== kycUser.fullName.trim().toLowerCase();
          return (
            <div className="space-y-4">
              <div className={`rounded-xl px-4 py-3 text-sm ${
                method.trust === 'high' ? 'bg-emerald-500/10 text-emerald-300' : method.trust === 'low' ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-800 text-slate-400'
              }`}>
                <span className="font-semibold">Verification method: </span>{method.label}
              </div>

              {kycUser.aadhaarVerifiedName && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Name on verified ID</p>
                  <p className={`text-sm ${nameMismatch ? 'text-red-400 font-semibold' : 'text-slate-200'}`}>{kycUser.aadhaarVerifiedName}</p>
                  {nameMismatch && <p className="text-xs text-red-400 mt-1">⚠ Doesn't match the account name ("{kycUser.fullName}") — worth a closer look before trusting this account.</p>}
                </div>
              )}

              {kycUser.kycDocUrl && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Uploaded document</p>
                  <a href={kycUser.kycDocUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-400 hover:text-brand-300 underline break-all">
                    {kycUser.kycDocUrl}
                  </a>
                </div>
              )}

              {method.trust === 'none' && (
                <p className="text-sm text-slate-500">This user hasn't completed any KYC path yet — nothing to review.</p>
              )}

              {kycLog.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2">Verification history</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {kycLog.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <p className="text-slate-200 font-semibold">{entry.method.replace(/_/g, ' ')}</p>
                          {entry.detail && <p className="text-slate-500 truncate">{entry.detail}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`font-bold px-2 py-0.5 rounded-full ${entry.outcome === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                            {entry.outcome}
                          </span>
                          <p className="text-slate-600 mt-0.5">{new Date(entry.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button onClick={() => setKycUser(null)} className="text-sm font-semibold px-4 py-2 rounded-lg text-slate-400 hover:text-white transition">Close</button>
                <button
                  disabled={busyId === kycUser.id}
                  onClick={() => toggleKyc(kycUser)}
                  className={`text-sm font-semibold px-4 py-2 rounded-lg transition text-white ${kycUser.isKycVerified ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  {kycUser.isKycVerified ? 'Reset to Unverified' : 'Mark Verified'}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </AdminShell>
  );
}
