'use client';

import React, { useState } from 'react';
import { bankApi } from '../lib/api';
import { useToast } from './Toast';
import { useAuth } from '../lib/auth-context';

export default function BankVerification() {
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const [ifsc, setIfsc] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [verifying, setVerifying] = useState(false);

  if (!user) return null;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    try {
      await bankApi.verify(ifsc.toUpperCase(), accountNumber);
      await refresh();
      show('Bank account verified!', 'success');
    } catch (err: any) {
      show(err.message ?? 'Bank verification failed', 'error');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="font-bold text-gray-900 mb-1">Your Financial Details</h2>
      <p className="text-xs text-gray-500 mb-4">Bank account, verified via Sandbox penny-drop — required before payouts can be released.</p>

      {user.bankAccountVerified ? (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="text-sm font-bold text-emerald-700">Bank account verified</p>
            <p className="text-xs text-emerald-600">
              {user.bankNameAtBank} · A/C ending {user.bankAccountNumber?.slice(-4)} · {user.bankIfsc}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Account Number</label>
            <input
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ''))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">IFSC Code</label>
            <input
              required
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
              placeholder="SBIN0061411"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <button
            type="submit"
            disabled={verifying}
            className="sm:col-span-2 btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-2.5 rounded-xl transition text-sm"
          >
            {verifying ? 'Verifying (penny drop)…' : 'Verify Bank Account'}
          </button>
        </form>
      )}
    </div>
  );
}
