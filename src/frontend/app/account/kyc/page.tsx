'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../lib/auth-context';
import { useToast } from '../../../components/Toast';
import { kycApi } from '../../../lib/api';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function KycInner() {
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const searchParams = useSearchParams();
  const [aadhaar, setAadhaar] = useState('');
  const [otp, setOtp] = useState('');
  const [referenceId, setReferenceId] = useState<string | number | undefined>();
  const [stubbed, setStubbed] = useState(false);
  const [stage, setStage] = useState<'aadhaar' | 'otp'>('aadhaar');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [digilockerLoading, setDigilockerLoading] = useState(false);
  const [checkingDigilocker, setCheckingDigilocker] = useState(false);
  const [dlFile, setDlFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [dlVerifying, setDlVerifying] = useState(false);

  // Returned from DigiLocker's consent screen — poll for the final status.
  useEffect(() => {
    if (searchParams.get('digilocker') !== '1' || !user || user.isKycVerified) return;
    setCheckingDigilocker(true);
    kycApi
      .digilockerStatus()
      .then(async (res) => {
        if (res.data.isKycVerified) {
          await refresh();
          show('Verified via DigiLocker!', 'success');
        } else {
          show('DigiLocker verification is still pending — try again in a moment.', 'error');
        }
      })
      .catch((err: any) => show(err.message ?? 'Could not confirm DigiLocker status', 'error'))
      .finally(() => setCheckingDigilocker(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleStartDigilocker() {
    setDigilockerLoading(true);
    try {
      const res = await kycApi.startDigilocker();
      window.location.href = res.data.url;
    } catch (err: any) {
      show(err.message ?? 'Could not start DigiLocker verification', 'error');
      setDigilockerLoading(false);
    }
  }

  async function handleVerifyDrivingLicense() {
    if (!dlFile && !selfieFile) return;
    setDlVerifying(true);
    try {
      const docBase64 = dlFile ? await fileToBase64(dlFile) : undefined;
      const selfieBase64 = selfieFile ? await fileToBase64(selfieFile) : undefined;
      const res = await kycApi.verifyDrivingLicense(docBase64, selfieBase64);
      await refresh();
      setDlFile(null);
      setSelfieFile(null);
      if (res.selfieCheck.attempted) {
        show(res.selfieCheck.passed ? 'Driving license and identity verified!' : "License verified, but the selfie didn't pass our identity checks — try a clearer, well-lit photo.", res.selfieCheck.passed ? 'success' : 'error');
      } else {
        show('Driving license verified!', 'success');
      }
    } catch (err: any) {
      show(err.message ?? 'Could not verify driving license', 'error');
    } finally {
      setDlVerifying(false);
    }
  }

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
          {checkingDigilocker ? (
            <p className="text-center text-sm text-gray-400 py-8">Confirming your DigiLocker verification…</p>
          ) : user.isKycVerified ? (
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

              <button
                type="button"
                onClick={handleStartDigilocker}
                disabled={digilockerLoading}
                className="w-full border-2 border-gray-900 text-gray-900 font-bold py-3 rounded-xl transition hover:bg-gray-900 hover:text-white disabled:opacity-50"
              >
                {digilockerLoading ? 'Redirecting to DigiLocker…' : '🔒 Verify Instantly via DigiLocker'}
              </button>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <div className="flex-1 h-px bg-gray-100" /> or verify with OTP <div className="flex-1 h-px bg-gray-100" />
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

        <h2 className="text-lg font-bold text-gray-900 mt-8 mb-1">Driving License</h2>
        <p className="text-gray-500 text-sm mb-4">
          Separate from identity KYC above — confirms you actually hold a valid license, required before renting a car.
        </p>
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {user.isDrivingLicenseVerified ? (
            <div className="text-center py-6">
              <span className="text-4xl block mb-3">✅</span>
              <p className="font-bold text-gray-900">Driving license verified</p>
              {user.isSelfieVerified ? (
                <p className="text-sm text-emerald-600 mt-2">✓ Identity confirmed via selfie match</p>
              ) : (
                <div className="mt-5 max-w-xs mx-auto space-y-3 text-left">
                  <p className="text-xs text-gray-400 text-center">Add a selfie for stronger identity verification (optional)</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-amber-50 file:text-amber-700 file:font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyDrivingLicense}
                    disabled={!selfieFile || dlVerifying}
                    className="w-full text-xs font-semibold border-2 border-gray-900 text-gray-900 px-4 py-2.5 rounded-xl transition hover:bg-gray-900 hover:text-white disabled:opacity-50"
                  >
                    {dlVerifying ? 'Checking…' : 'Verify Selfie'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Upload a clear photo of your license</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setDlFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-amber-50 file:text-amber-700 file:font-semibold"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Add a selfie for stronger identity verification (optional)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-amber-50 file:text-amber-700 file:font-semibold"
                />
              </label>
              <button
                type="button"
                onClick={handleVerifyDrivingLicense}
                disabled={!dlFile || dlVerifying}
                className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
              >
                {dlVerifying ? 'Verifying…' : 'Verify Driving License'}
              </button>
            </div>
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
      <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
        <KycInner />
      </Suspense>
    </ProtectedRoute>
  );
}
