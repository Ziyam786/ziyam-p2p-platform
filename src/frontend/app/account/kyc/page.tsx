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
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');
  const [referenceId, setReferenceId] = useState<string | number | undefined>();
  const [stubbed, setStubbed] = useState(false);
  const [stage, setStage] = useState<'aadhaar' | 'otp'>('aadhaar');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (!user) return null;

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await kycApi.sendAadhaarOtp(aadhaar);
      setStubbed(res.stubbed);
      setReferenceId(res.referenceId);
      if (res.stubbed) {
        // No Sandbox key configured — skip straight to instant verification.
        await kycApi.verifyAadhaarOtp(undefined, undefined);
        await refresh();
        show('KYC verified instantly (Sandbox not configured)', 'success');
      } else {
        setStage('otp');
        show('OTP sent to your Aadhaar-linked mobile number', 'success');
      }
    } catch (err: any) {
      show(err.message ?? 'Failed to send OTP', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    try {
      await kycApi.verifyAadhaarOtp(referenceId, otp);
      await refresh();
      show('KYC verified!', 'success');
    } catch (err: any) {
      show(err.message ?? 'OTP verification failed', 'error');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 pt-28 pb-24">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">KYC Verification</h1>
        <p className="text-gray-500 text-sm mb-8">
          One-time Aadhaar identity verification, powered by Sandbox eKYC. Required before booking or listing a car.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {user.isKycVerified ? (
            <div className="text-center py-8">
              <span className="text-4xl block mb-3">✅</span>
              <p className="font-bold text-gray-900">You're verified</p>
              <p className="text-sm text-gray-500 mt-1">Your identity has been confirmed. You're all set to book or list cars.</p>
            </div>
          ) : stage === 'aadhaar' ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="flex gap-3">
                <span className="text-xs font-semibold bg-amber-50 text-amber-600 px-3 py-1.5 rounded-full">🪪 Aadhaar eKYC</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Aadhaar Number
                </label>
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{12}"
                  maxLength={12}
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
                  placeholder="12-digit Aadhaar number"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <p className="text-xs text-gray-400 mt-1">
                  We'll send a one-time password to your Aadhaar-linked mobile number via UIDAI.
                </p>
              </div>
              <button
                type="submit"
                disabled={sending || aadhaar.length !== 12}
                className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
              >
                {sending ? 'Sending OTP…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <p className="text-sm text-gray-600">Enter the 6-digit OTP sent to your Aadhaar-linked mobile number.</p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">OTP</label>
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit OTP"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-center tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                type="submit"
                disabled={verifying || otp.length !== 6}
                className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
              >
                {verifying ? 'Verifying…' : 'Verify OTP'}
              </button>
              <button type="button" onClick={() => setStage('aadhaar')} className="w-full text-xs text-gray-400 hover:text-gray-600 font-semibold">
                ← Change Aadhaar number
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
