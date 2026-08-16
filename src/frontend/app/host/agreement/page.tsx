'use client';

import React, { useState } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import ProtectedRoute from '../../../components/ProtectedRoute';
import FileUploadField from '../../../components/FileUploadField';
import { useToast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth-context';
import { usersApi, ApiError } from '../../../lib/api';

function AgreementInner() {
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  const wetSigned = Boolean(user?.partnerAgreementWetSignedUrl);
  const eSigned = user?.partnerAgreementEsignStatus === 'sign_complete';
  const payoutEligible = wetSigned && eSigned;

  async function handleWetUpload(url: string) {
    setBusy(true);
    try {
      await usersApi.uploadPartnerAgreementWetSignature(url);
      await refresh();
      show('Wet-signed agreement uploaded', 'success');
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleEsignStart() {
    setBusy(true);
    try {
      await usersApi.startPartnerAgreementEsign();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'E-sign is not available yet', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-24">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Host Onboarding Agreement</h1>
        <p className="text-gray-500 text-sm mb-8">
          The one-time agreement between you and ZiyamSelfDrive covering the platform commission, N+1 payout terms,
          and general host obligations. Per platform policy, payouts don't release until this is fully completed —
          both a wet and an e-signature are required.
        </p>

        <div className={`rounded-2xl p-5 mb-6 border ${payoutEligible ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="font-bold text-gray-900 mb-1">
            {payoutEligible ? '✓ Fully signed — payouts are unblocked' : '⚠ Documentation incomplete — payouts are on hold'}
          </p>
          <p className="text-sm text-gray-700">
            Wet signature: <strong>{wetSigned ? 'Received' : 'Not yet uploaded'}</strong>
            {' · '}
            E-signature: <strong>{eSigned ? 'Complete' : 'Not yet started'}</strong>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-1">1. Wet Signature</h2>
          <p className="text-sm text-gray-500 mb-4">
            Photograph or scan a physically-signed copy of the agreement your account manager shared with you, and
            upload it here.
          </p>
          <FileUploadField
            label="Signed agreement"
            value={user?.partnerAgreementWetSignedUrl ?? ''}
            onChange={handleWetUpload}
            kind="document"
          />
          {busy && <p className="text-xs text-gray-400 mt-2">Saving…</p>}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-900 mb-1">2. E-Signature</h2>
          <p className="text-sm text-gray-500 mb-4">
            Aadhaar-based e-signing, the same technology used for trip lease agreements — not available yet for this
            document while the official agreement text is being finalized.
          </p>
          <button
            disabled
            onClick={handleEsignStart}
            className="bg-gray-200 text-gray-400 font-bold px-5 py-2.5 rounded-xl text-sm cursor-not-allowed"
            title="Coming soon"
          >
            Start E-Sign (Coming Soon)
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function HostAgreementPage() {
  return (
    <ProtectedRoute>
      <AgreementInner />
    </ProtectedRoute>
  );
}
