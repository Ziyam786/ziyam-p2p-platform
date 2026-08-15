'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { adminApi } from '../../lib/api';
import type { AuditEntry } from '../../lib/types';

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.auditLog().then((res) => setEntries(res.data)).finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell title="Audit Log" subtitle="Every mutating action taken from this control panel">
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-slate-500">No admin actions recorded yet.</p>
      ) : (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">When</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-3 px-4"><span className="bg-slate-800 text-slate-200 px-2 py-1 rounded text-xs font-semibold">{e.action}</span></td>
                  <td className="py-3 px-4 text-slate-400 text-xs">{e.targetType} · {e.targetId.slice(0, 8)}…</td>
                  <td className="py-3 px-4 text-slate-500 text-xs max-w-xs truncate">{e.meta ? JSON.stringify(e.meta) : '—'}</td>
                  <td className="py-3 px-4 text-slate-500 text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
