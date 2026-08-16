'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { opsInvoiceApi } from '../../lib/api';
import type { OpsInvoiceRow, OpsInvoiceStatus, OpsInvoiceType } from '../../lib/types';

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const STATUS_STYLES: Record<OpsInvoiceStatus, string> = {
  DRAFT: 'bg-slate-800 text-slate-400',
  PENDING: 'bg-amber-500/10 text-amber-400',
  SENT: 'bg-blue-500/10 text-blue-400',
  PAID: 'bg-emerald-500/10 text-emerald-400',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<OpsInvoiceRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    opsInvoiceApi.list({ type: typeFilter || undefined }).then((res) => setInvoices(res.data)).finally(() => setLoading(false));
  }, [typeFilter]);

  return (
    <AdminShell title="Invoices" subtitle="Vehicle Rental & Vehicle Service invoices, with GST breakdown">
      <div className="flex gap-2 mb-6">
        {(['', 'RENTAL', 'SERVICE'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${typeFilter === t ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            {t === '' ? 'All' : t === 'RENTAL' ? 'Vehicle Rental' : 'Vehicle Service'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="text-slate-500 text-center py-16">No invoices generated yet — generate one from a completed Ops Trip.</p>
      ) : (
        <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-800">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">GST</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Issued</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const car = inv.trip?.car ?? inv.service?.car;
                const gst = (inv.cgstAmount ?? 0) + (inv.sgstAmount ?? 0) + (inv.igstAmount ?? 0);
                return (
                  <tr key={inv.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 cursor-pointer" onClick={() => window.location.href = `/invoices/${inv.id}`}>
                    <td className="py-3 px-4 font-mono text-brand-400">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4 text-slate-300">{inv.type === 'RENTAL' ? 'Rental' : 'Service'}</td>
                    <td className="py-3 px-4 text-slate-400">{car ? `${car.make} ${car.model}` : '—'}</td>
                    <td className="py-3 px-4 text-slate-400">{inv.customerName ?? '—'}</td>
                    <td className="py-3 px-4 text-slate-200 font-semibold">{inr(inv.amount)}</td>
                    <td className="py-3 px-4 text-slate-500">{gst > 0 ? inr(gst) : '—'}</td>
                    <td className="py-3 px-4"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[inv.status]}`}>{inv.status}</span></td>
                    <td className="py-3 px-4 text-slate-500">{new Date(inv.issuedAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
