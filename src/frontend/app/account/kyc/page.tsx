'use client';

import React, { useState } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../lib/auth-context';
import { useToast } from '../../../components/Toast';
import { kycApi } from '../../../lib/api';

function KycInner() {
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const [docUrl, setDocUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await kycApi.submit(docUrl);
      await refresh();
      show('KYC verified instantly!', 'success');
    } catch (err: any) {
      show(err.message ?? 'KYC submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 pt-28 pb-24">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">KYC Verification</h1>
        <p className="text-gray-500 text-sm mb-8">
          One-time identity verification via DigiLocker. Required before booking or listing a car.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {user.isKycVerified ? (
            <div className="text-center py-8">
              <span className="text-4xl block mb-3">✅</span>
              <p className="font-bold text-gray-900">You're verified</p>
              <p className="text-sm text-gray-500 mt-1">Your identity has been confirmed. You're all set to book or list cars.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex gap-3">
                {['🪪 Aadhaar', '🚘 Driving Licence'].map((doc) => (
                  <span key={doc} className="text-xs font-semibold bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full">{doc}</span>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Document URL (mock upload)
                </label>
                <input
                  required
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://digilocker.gov.in/documents/..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <p className="text-xs text-gray-400 mt-1">
                  In production this would be a real DigiLocker OAuth handoff — see the README for the integration TODO.
                </p>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
              >
                {submitting ? 'Verifying…' : 'Verify Instantly'}
              </button>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function KycPage() {
  return (
    <ProtectedRoute>
      <KycInner />
    </ProtectedRoute>
  );
}
