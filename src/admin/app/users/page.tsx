'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { AdminUser, Role } from '../../lib/types';

const ROLES: Role[] = ['CUSTOMER', 'SELF_HOST', 'FLEET_OPERATOR', 'AGENT', 'ADMIN'];

export default function UsersPage() {
  const { show } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminApi.users(roleFilter || undefined).then((res) => setUsers(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [roleFilter]);

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
                <th className="py-3 px-4">KYC</th>
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
                    <button
                      disabled={busyId === u.id}
                      onClick={() => toggleKyc(u)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.isKycVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {u.isKycVerified ? 'Verified' : 'Unverified'}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${u.isSuspended ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {u.isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
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
    </AdminShell>
  );
}
