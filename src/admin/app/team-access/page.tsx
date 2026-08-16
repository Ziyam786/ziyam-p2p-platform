'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import { PERMISSION_KEYS, type CustomRoleRow, type PermissionKey } from '../../lib/types';

const rowInput = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full';

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  dashboard: 'Command Center',
  earnings: 'Trip Earnings',
  collections: 'Direct Collections',
  expenses: 'Spend',
  outstandings: 'Outstanding Dues and Payables',
  balanceSheet: 'Balance Sheet',
  plStatement: 'Profit & Loss',
  config: 'Control Panel',
  roles: 'Team & Access',
};

function emptyPermissions(): Record<PermissionKey, boolean> {
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])) as Record<PermissionKey, boolean>;
}

export default function TeamAccessPage() {
  const { show } = useToast();
  const [roles, setRoles] = useState<CustomRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomRoleRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CustomRoleRow | null>(null);

  function load() {
    setLoading(true);
    adminApi.customRoles().then((res) => setRoles(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <AdminShell title="Team & Access" subtitle='"Who Can Do What" — granular screen permissions for internal ops/finance staff (Fleet Admin, Operations Executive, Mechanical Executive, Technician, Agent)'>
      <div className="flex justify-end mb-6">
        <button onClick={() => setEditing('new')} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">
          + New Role
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : roles.length === 0 ? (
        <p className="text-slate-500 text-center py-16">No custom roles yet. Create one to grant internal staff access to specific screens.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((r) => (
            <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-slate-100">{r.name}</h3>
                  {r.description && <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>}
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-800 text-slate-400 shrink-0">
                  {r._count?.users ?? 0} user{(r._count?.users ?? 0) === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {PERMISSION_KEYS.filter((k) => r.permissions[k]).map((k) => (
                  <span key={k} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-brand-500/10 text-brand-400">{PERMISSION_LABELS[k]}</span>
                ))}
                {PERMISSION_KEYS.every((k) => !r.permissions[k]) && <span className="text-[10px] text-slate-600">No screens granted</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(r)} className="text-xs font-semibold border border-slate-700 hover:border-brand-500 text-slate-300 hover:text-brand-400 px-3 py-1.5 rounded-lg transition">
                  Edit
                </button>
                <button onClick={() => setDeleting(r)} className="text-xs font-semibold border border-slate-700 hover:border-red-500 text-slate-400 hover:text-red-400 px-3 py-1.5 rounded-lg transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <RoleEditorModal role={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); load(); }} show={show} />}
      {deleting && <DeleteRoleModal role={deleting} onClose={() => setDeleting(null)} onDone={() => { setDeleting(null); load(); }} show={show} />}
    </AdminShell>
  );
}

function RoleEditorModal({ role, onClose, onDone, show }: {
  role: CustomRoleRow | null; onClose: () => void; onDone: () => void; show: (m: string, t: 'success' | 'error') => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>(role?.permissions ?? emptyPermissions());
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return show('Role name is required', 'error');
    setSubmitting(true);
    try {
      if (role) {
        await adminApi.updateCustomRole(role.id, { name, description, permissions });
        show('Role updated', 'success');
      } else {
        await adminApi.createCustomRole({ name, description, permissions });
        show('Role created', 'success');
      }
      onDone();
    } catch (err: any) {
      show(err.message ?? 'Failed to save role', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={role ? `Edit Role — ${role.name}` : 'New Custom Role'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Role Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Finance Executive" className={rowInput} required />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Description (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={rowInput} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-2">Screen Access</label>
          <div className="space-y-2">
            {PERMISSION_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={permissions[key]}
                  onChange={(e) => setPermissions((p) => ({ ...p, [key]: e.target.checked }))}
                  className="w-4 h-4 accent-brand-500"
                />
                {PERMISSION_LABELS[key]}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={submitting} className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold py-2.5 rounded-lg transition">
          {submitting ? 'Saving…' : role ? 'Save Changes' : 'Create Role'}
        </button>
      </form>
    </Modal>
  );
}

function DeleteRoleModal({ role, onClose, onDone, show }: {
  role: CustomRoleRow; onClose: () => void; onDone: () => void; show: (m: string, t: 'success' | 'error') => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const matches = confirmText.trim() === role.name;

  async function handleDelete() {
    if (!matches) return;
    setBusy(true);
    try {
      await adminApi.deleteCustomRole(role.id);
      show('Role deleted', 'success');
      onDone();
    } catch (err: any) {
      show(err.message ?? 'Failed to delete role', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Delete Custom Role">
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          This will remove <strong>{role.name}</strong> and unassign it from{' '}
          {role._count?.users ?? 0} user{(role._count?.users ?? 0) === 1 ? '' : 's'}. This can't be undone.
        </p>
        <p className="text-sm text-slate-400">
          Type <strong className="text-slate-200">{role.name}</strong> to confirm:
        </p>
        <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={rowInput} autoFocus />
        <button
          disabled={!matches || busy}
          onClick={handleDelete}
          className="w-full bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold py-2.5 rounded-lg transition"
        >
          {busy ? 'Deleting…' : 'Delete Role'}
        </button>
      </div>
    </Modal>
  );
}
