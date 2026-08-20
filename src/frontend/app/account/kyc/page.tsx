'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../lib/auth-context';
import { useToast } from '../../../components/Toast';
import { kycApi } from '../../../lib/api';

function fileToCompressedBase64(file: File): Promise<string> {
  const MAX_EDGE = 1600;
  const JPEG_QUALITY = 0.72;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not prepare that photo. Try another image.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve((canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]) ?? '');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read that photo. Use a JPEG or PNG.'));
    };
    img.src = objectUrl;
  });
}

function KycInner() {
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get('next');
  const nextPath = nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : null;
  const [storedNext] = useState(() => {
    if (typeof window === 'undefined') return null;
    const stored = sessionStorage.getItem('kycNext');
    return stored && stored.startsWith('/') && !stored.startsWith('//') ? stored : null;
  });
  const afterKyc = nextPath ?? storedNext;
  const [identityPath, setIdentityPath] = useState<'aadhaar' | 'photo'>('aadhaar');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [aadhaarRef, setAadhaarRef] = useState<string | number | null>(null);
  const [aadhaarSending, setAadhaarSending] = useState(false);
  const [aadhaarVerifying, setAadhaarVerifying] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idSelfieFile, setIdSelfieFile] = useState<File | null>(null);
  const [idVerifying, setIdVerifying] = useState(false);
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
          if (afterKyc) router.push(afterKyc);
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
      if (nextPath) sessionStorage.setItem('kycNext', nextPath);
      const res = await kycApi.startDigilocker();
      window.location.href = res.data.url;
    } catch (err: any) {
      show(err.message ?? 'Could not start DigiLocker. Try Aadhaar OTP or a photo of your ID.', 'error');
      setDigilockerLoading(false);
    }
  }

  async function handleVerifyDrivingLicense() {
    if (!dlFile && !selfieFile) return;
    setDlVerifying(true);
    try {
      const docBase64 = dlFile ? await fileToCompressedBase64(dlFile) : undefined;
      const selfieBase64 = selfieFile ? await fileToCompressedBase64(selfieFile) : undefined;
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

  async function handleSendAadhaarOtp() {
    const digits = aadhaarNumber.replace(/\D/g, '');
    if (!/^\d{12}$/.test(digits)) {
      show('Enter your 12-digit Aadhaar number', 'error');
      return;
    }
    setAadhaarSending(true);
    try {
      const res = await kycApi.sendAadhaarOtp(digits);
      setAadhaarRef(res.referenceId ?? null);
      show(res.message ?? 'OTP sent to the mobile number linked to your Aadhaar', 'success');
    } catch (err: any) {
        show(err.message ?? 'Could not send OTP. If this keeps happening, try a photo of your ID instead.', 'error');
    } finally {
      setAadhaarSending(false);
    }
  }

  async function handleVerifyAadhaarOtp() {
    if (!/^\d{6}$/.test(aadhaarOtp)) {
      show('Enter the 6-digit OTP', 'error');
      return;
    }
    setAadhaarVerifying(true);
    try {
      const res = await kycApi.verifyAadhaarOtp(aadhaarRef ?? undefined, aadhaarOtp);
      await refresh();
      setAadhaarNumber('');
      setAadhaarOtp('');
      setAadhaarRef(null);
      show('Identity verified via Aadhaar OTP', 'success');
      if (afterKyc && res.data.isKycVerified && user?.isDrivingLicenseVerified) router.push(afterKyc);
    } catch (err: any) {
      show(err.message ?? 'Could not verify that OTP. Try again or use a photo of your ID.', 'error');
    } finally {
      setAadhaarVerifying(false);
    }
  }

  async function handleVerifyIdentity() {
    if (!idFile) return;
    setIdVerifying(true);
    try {
      const docBase64 = await fileToCompressedBase64(idFile);
      const selfieBase64 = idSelfieFile ? await fileToCompressedBase64(idSelfieFile) : undefined;
      const res = await kycApi.verifyIdentityDocument(docBase64, selfieBase64);
      await refresh();
      setIdFile(null);
      setIdSelfieFile(null);
      if (res.selfieCheck.attempted && !res.selfieCheck.passed) {
        show('ID verified, but the selfie did not pass liveness/face-match — try a clearer, well-lit photo.', 'error');
      } else {
        show('Identity verified', 'success');
        if (afterKyc && res.data.isKycVerified && user?.isDrivingLicenseVerified) router.push(afterKyc);
      }
    } catch (err: any) {
      show(err.message ?? 'Could not verify ID', 'error');
    } finally {
      setIdVerifying(false);
    }
  }

  if (!user) return null;

  const isHost = user.role === 'SELF_HOST' || user.role === 'FLEET_OPERATOR';

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 pt-28 pb-24">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">
          {isHost ? 'Verify to list your car' : 'Verify to book a car'}
        </h1>
        <p className="text-gray-500 text-sm mb-3">
          {isHost
            ? 'Guests need to know who they are renting from. We confirm your identity before your listing can go live, and we confirm your driving licence if you also drive.'
            : 'We confirm your identity and driving licence before your first trip, so hosts know who is picking up their car.'}
        </p>
        <p className="text-gray-500 text-sm mb-8">
          We do not store your 12-digit Aadhaar number. If we keep an Aadhaar photo for review, the number is masked first.{' '}
          <Link href="/privacy" className="font-semibold text-gray-900 underline underline-offset-2">
            How we use this data
          </Link>
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {checkingDigilocker ? (
            <p className="text-center text-sm text-gray-400 py-8">Confirming your DigiLocker verification…</p>
          ) : user.isKycVerified ? (
            <div className="text-center py-8">
              <span className="text-4xl block mb-3">✅</span>
              <p className="font-bold text-gray-900">You're verified</p>
              <p className="text-sm text-gray-500 mt-1">Your identity has been confirmed. Complete driving-licence verification below if you still need it.</p>
              {afterKyc && (
                <Link href={afterKyc} className="inline-block mt-4 btn-gradient text-white font-bold px-5 py-2.5 rounded-xl text-sm">
                  Continue onboarding
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIdentityPath('aadhaar')}
                  className={`text-xs font-bold py-2.5 rounded-xl border-2 transition ${
                    identityPath === 'aadhaar' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-100 text-gray-500'
                  }`}
                >
                  Aadhaar OTP
                </button>
                <button
                  type="button"
                  onClick={() => setIdentityPath('photo')}
                  className={`text-xs font-bold py-2.5 rounded-xl border-2 transition ${
                    identityPath === 'photo' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-100 text-gray-500'
                  }`}
                >
                  Photo of ID
                </button>
              </div>

              {identityPath === 'aadhaar' ? (
                <>
                  <p className="text-sm text-gray-600">OTP is sent to the mobile number linked to your Aadhaar. We do not store your Aadhaar number.</p>
                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">12-digit Aadhaar number</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={12}
                      value={aadhaarNumber}
                      onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm tracking-widest"
                      placeholder="XXXXXXXXXXXX"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleSendAadhaarOtp}
                    disabled={aadhaarNumber.length !== 12 || aadhaarSending}
                    className={
                      aadhaarRef
                        ? 'w-full border border-gray-200 hover:border-amber-400 disabled:opacity-60 text-gray-700 font-semibold py-3 rounded-xl transition text-sm'
                        : 'w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition'
                    }
                  >
                    {aadhaarSending ? 'Sending OTP…' : aadhaarRef ? 'Resend OTP' : 'Send Aadhaar OTP'}
                  </button>
                  {aadhaarRef != null && (
                    <>
                      <label className="block">
                        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">6-digit OTP</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={aadhaarOtp}
                          onChange={(e) => setAadhaarOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm tracking-widest"
                          placeholder="••••••"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleVerifyAadhaarOtp}
                        disabled={aadhaarOtp.length !== 6 || aadhaarVerifying}
                        className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
                      >
                        {aadhaarVerifying ? 'Verifying…' : 'Verify Aadhaar OTP'}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600">Upload a clear photo of your Aadhaar, PAN, voter ID, or passport. Optionally add a selfie so we can run liveness, deepfake, and face-match checks.</p>
                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">ID document photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-amber-50 file:text-amber-700 file:font-semibold"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Selfie (optional, recommended)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setIdSelfieFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-amber-50 file:text-amber-700 file:font-semibold"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleVerifyIdentity}
                    disabled={!idFile || idVerifying}
                    className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
                  >
                    {idVerifying ? 'Checking your photo…' : 'Verify identity'}
                  </button>
                </>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <div className="flex-1 h-px bg-gray-100" /> or <div className="flex-1 h-px bg-gray-100" />
              </div>
              <button
                type="button"
                onClick={handleStartDigilocker}
                disabled={digilockerLoading}
                className="w-full border-2 border-gray-900 text-gray-900 font-bold py-3 rounded-xl transition hover:bg-gray-900 hover:text-white disabled:opacity-50"
              >
                {digilockerLoading ? 'Redirecting to DigiLocker…' : 'Verify via DigiLocker instead'}
              </button>
            </div>
          )}
        </div>

        <h2 className="text-lg font-bold text-gray-900 mt-8 mb-1">Driving License</h2>
        <p className="text-gray-500 text-sm mb-4">
          Separate from identity above — we need a valid licence before you can drive a Ziyam car.
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
