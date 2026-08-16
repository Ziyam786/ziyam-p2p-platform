'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { opsInvoiceApi } from '../../../lib/api';
import type { OpsInvoiceRow } from '../../../lib/types';

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function InvoiceInner() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<OpsInvoiceRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    opsInvoiceApi.get(params.id).then((res) => setInvoice(res.data)).finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <p className="text-center pt-32 text-slate-400">Loading…</p>;
  if (!invoice) return <p className="text-center pt-32 text-slate-400">Invoice not found.</p>;

  const car = invoice.trip?.car ?? invoice.service?.car;
  const gstTotal = (invoice.cgstAmount ?? 0) + (invoice.sgstAmount ?? 0) + (invoice.igstAmount ?? 0);
  const grandTotal = invoice.amount + gstTotal;

  return (
    <div className="min-h-screen bg-slate-950 py-10 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto px-4 print:px-0">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <a href="/invoices" className="text-xs text-slate-400 hover:text-brand-400">← Back to invoices</a>
          <button onClick={() => window.print()} className="text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition">
            Print / Save as PDF
          </button>
        </div>

        <div className="bg-white text-gray-900 rounded-2xl p-8 sm:p-10 print:rounded-none print:p-4">
          <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-200">
            <div>
              <h1 className="text-xl font-extrabold">EIGHTLINESFLEET</h1>
              <p className="text-xs text-gray-500">Eightlines Fleet Private Limited</p>
              <p className="text-xs text-gray-500">8-Lines Fleet, 15th Cross Rd, Popular Colony, Mangammanapalya, Bengaluru, Karnataka 560068</p>
              <p className="text-xs text-gray-500">CIN: U77100KA2026PTC21777</p>
            </div>
            <div className="text-right">
              <h2 className="font-bold text-lg">{invoice.type === 'RENTAL' ? 'Vehicle Rental Invoice' : 'Vehicle Service Invoice'}</h2>
              <p className="text-xs text-gray-500 font-mono">{invoice.invoiceNumber}</p>
              <p className="text-xs text-gray-500">{new Date(invoice.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{invoice.status}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
              <p className="font-semibold">{invoice.customerName ?? '—'}</p>
              <p className="text-gray-500">{invoice.customerMobile ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Vehicle</p>
              <p className="font-semibold">{car ? `${car.make} ${car.model}` : '—'}</p>
              <p className="text-gray-500">{car?.registrationNo ?? '—'}</p>
            </div>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase tracking-wider">
                <th className="pb-2">Description</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-2">{invoice.type === 'RENTAL' ? `Vehicle Rental — ${car ? `${car.make} ${car.model}` : ''}` : `${invoice.service?.serviceType ?? 'Service'} — ${car ? `${car.make} ${car.model}` : ''}`}</td>
                <td className="py-2 text-right">{inr(invoice.amount)}</td>
              </tr>
              {invoice.gstRate != null && (
                <>
                  {invoice.cgstAmount != null && (
                    <tr>
                      <td className="py-2 text-gray-500">CGST ({Math.round((invoice.gstRate / 2) * 100)}%)</td>
                      <td className="py-2 text-right text-gray-500">{inr(invoice.cgstAmount)}</td>
                    </tr>
                  )}
                  {invoice.sgstAmount != null && (
                    <tr>
                      <td className="py-2 text-gray-500">SGST ({Math.round((invoice.gstRate / 2) * 100)}%)</td>
                      <td className="py-2 text-right text-gray-500">{inr(invoice.sgstAmount)}</td>
                    </tr>
                  )}
                  {invoice.igstAmount != null && (
                    <tr>
                      <td className="py-2 text-gray-500">IGST ({Math.round(invoice.gstRate * 100)}%)</td>
                      <td className="py-2 text-right text-gray-500">{inr(invoice.igstAmount)}</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-800 font-bold">
                <td className="pt-3">Grand Total</td>
                <td className="pt-3 text-right">{inr(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>

          {invoice.placeOfSupply && (
            <p className="text-[10px] text-gray-400 mb-6">Place of Supply: {invoice.placeOfSupply}</p>
          )}

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Facilitation Fee Split</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Fleet Operator ({invoice.serviceChargePct}%)</span>
              <span className="font-semibold">{inr(invoice.serviceCharge)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Owner ({100 - invoice.serviceChargePct}%)</span>
              <span className="font-semibold">{inr(invoice.netToOwner)}</span>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 text-center">
            This is a system-generated invoice from ZiyamSelfDrive, operated by Eightlines Fleet Private Limited.
            GST amounts are estimated using the platform's configured rate — confirm with your tax advisor before filing.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  return (
    <ProtectedRoute>
      <InvoiceInner />
    </ProtectedRoute>
  );
}
