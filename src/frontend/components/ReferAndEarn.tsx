'use client';

import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';

export default function ReferAndEarn() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user?.referralCode) return null;

  const link = typeof window !== 'undefined' ? `${window.location.origin}/signup?ref=${user.referralCode}` : '';

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the code is still visible to copy manually.
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-amber-100">
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white px-6 py-5">
        <p className="text-lg font-extrabold">🎁 Refer & Earn</p>
        <p className="text-sm text-amber-50 mt-1">Get ₹500 for every friend who completes their first trip</p>
      </div>
      <div className="bg-white px-6 py-5 space-y-4">
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Your Code</p>
            <p className="font-mono font-extrabold text-gray-900 text-lg">{user.referralCode}</p>
          </div>
          <button onClick={handleCopy} className="text-xs font-bold bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg transition">
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Credits Balance</p>
          <p className="text-lg font-extrabold text-emerald-600">₹{(user.creditsBalance ?? 0).toLocaleString('en-IN')}</p>
        </div>
      </div>
    </div>
  );
}
