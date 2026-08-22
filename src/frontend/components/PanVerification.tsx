'use client';

import React, { useState } from 'react';
import { usersApi } from '../lib/api';
import { useToast } from './Toast';
import { useAuth } from '../lib/auth-context';

export default function PanVerification() {
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const [pan, setPan] = useState('');
  const [nameAsPerPan, setNameAsPerPan] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!user) return null;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    try {
      await usersApi.verifyPan(pan.toUpperCase(), nameAsPerPan, dateOfBirth);
      await refresh();
      setEditing(false);
      show('PAN verified!', 'success');
    } catch (err: any) {
      show(err.message ?? 'PAN verification failed', 'error');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="font-bold text-gray-900 mb-1">PAN Verification</h2>
      <p className="text-xs text-gray-500 mb-4">Required before payouts can be released — verified via Sandbox.</p>

      {user.isPanVerified && !editing ? (
        <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="text-sm font-bold text-emerald-700">PAN verified</p>
              <p className="text-xs text-emerald-600">{user.panNumber}</p>
            </div>
          </div>
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-amber-600 hover:text-amber-700 shrink-0">
            Update
          </button>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">PAN Number</label>
            <input
              required
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              maxLength={10}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Name (as per PAN)</label>
            <input
              required
              value={nameAsPerPan}
              onChange={(e) => setNameAsPerPan(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date of Birth</label>
            <input
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="sm:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={verifying}
              className="flex-1 btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-2.5 rounded-xl transition text-sm"
            >
              {verifying ? 'Verifying…' : 'Verify PAN'}
            </button>
            {editing && (
              <button type="button" onClick={() => setEditing(false)} className="px-4 text-sm font-semibold text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
