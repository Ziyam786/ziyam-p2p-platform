'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import ProtectedRoute from '../../../components/ProtectedRoute';
import FileUploadField from '../../../components/FileUploadField';
import { useToast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth-context';
import { usersApi, ApiError } from '../../../lib/api';

const ESIGN_LABELS: Record<string, string> = {
  sign_initiated: 'Waiting for you to open the signing link',
  sign_pending: 'Waiting for signature',
  sign_in_progress: 'Signature in progress',
  sign_complete: 'Fully signed',
};

function AgreementInner() {
  const { user, refresh } = useAuth();
  const searchParams = useSearchParams();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  const wetSigned = Boolean(user?.partnerAgreementWetSignedUrl);
  const eSigned = user?.partnerAgreementEsignStatus === 'sign_complete';
  const payoutEligible = wetSigned && eSigned;

  useEffect(() => {
    if (searchParams.get('esigned') !== '1' || !user?.partnerAgreementEsignStatus) return;
    usersApi.partnerAgreementEsignStatus().then(() => refresh()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      show('eSign request created — check your email for the signing link', 'success');
      await refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to start eSign', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckEsignStatus() {
    setBusy(true);
    try {
      await usersApi.partnerAgreementEsignStatus();
      await refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to check status', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="print:hidden"><Navbar /></div>
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-24 print:pt-4">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <h1 className="text-2xl font-extrabold text-gray-900">Host Onboarding Agreement</h1>
          <button onClick={() => window.print()} className="text-xs font-bold bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg transition">
            Print / Save as PDF
          </button>
        </div>
        <p className="text-gray-500 text-sm mb-8 print:hidden">
          The one-time agreement between you and ZiyamSelfDrive covering the platform commission, N+1 payout terms,
          and general host obligations. Per platform policy, payouts don't release until this is fully completed —
          both a wet and an e-signature are required.
        </p>

        <div className={`rounded-2xl p-5 mb-6 border print:hidden ${payoutEligible ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="font-bold text-gray-900 mb-1">
            {payoutEligible ? '✓ Fully signed — payouts are unblocked' : '⚠ Documentation incomplete — payouts are on hold'}
          </p>
          <p className="text-sm text-gray-700">
            Wet signature: <strong>{wetSigned ? 'Received' : 'Not yet uploaded'}</strong>
            {' · '}
            E-signature: <strong>{eSigned ? 'Complete' : ESIGN_LABELS[user?.partnerAgreementEsignStatus ?? ''] ?? 'Not yet started'}</strong>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 print:hidden">
          <h2 className="font-bold text-gray-900 mb-1">1. Wet Signature</h2>
          <p className="text-sm text-gray-500 mb-4">
            Print or photograph the agreement text below, sign it, and upload a scan/photo — or upload any physically
            signed copy your account manager shared with you.
          </p>
          <FileUploadField
            label="Signed agreement"
            value={user?.partnerAgreementWetSignedUrl ?? ''}
            onChange={handleWetUpload}
            kind="document"
          />
          {busy && <p className="text-xs text-gray-400 mt-2">Saving…</p>}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8 print:hidden">
          <h2 className="font-bold text-gray-900 mb-1">2. E-Signature</h2>
          <p className="text-sm text-gray-500 mb-4">Aadhaar-based e-signing via Setu — the same technology used for trip lease agreements. You'll get a signing link by email.</p>
          {!user?.partnerAgreementEsignStatus ? (
            <button disabled={busy} onClick={handleEsignStart} className="btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold px-5 py-2.5 rounded-xl text-sm transition">
              {busy ? 'Starting…' : 'Start eSign'}
            </button>
          ) : eSigned ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-600 font-semibold">✓ Fully signed</span>
              {user.partnerAgreementEsignDownloadUrl && (
                <a href={user.partnerAgreementEsignDownloadUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg transition">
                  Download Signed PDF
                </a>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-600 font-semibold">{ESIGN_LABELS[user.partnerAgreementEsignStatus] ?? 'In progress'}</span>
              <button disabled={busy} onClick={handleCheckEsignStatus} className="text-xs font-bold border border-gray-200 hover:border-amber-400 px-4 py-2 rounded-lg transition">
                {busy ? 'Checking…' : 'Refresh Status'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 sm:p-10 text-sm text-gray-700 leading-relaxed print:border-0 print:rounded-none">
          <p className="text-center font-extrabold text-gray-900">EIGHTLINES FLEET PRIVATE LIMITED</p>
          <p className="text-center text-xs text-gray-400 mb-1">ZiyamSelfDrive — Bengaluru, Karnataka</p>
          <h2 className="text-xl font-extrabold text-gray-900 text-center mb-6">HOST ONBOARDING AGREEMENT</h2>

          <p className="text-xs italic text-gray-500 mb-4">
            This document is an electronic record in terms of the Information Technology Act, 2000, and rules
            thereunder as applicable. This electronic record is generated by a computer system and does not require
            physical signatures.
          </p>

          <p className="mb-4">This Host Onboarding Agreement ("Agreement") is a one-time, account-level agreement between the Host and Eightlines Fleet Private Limited, operating the ZiyamSelfDrive platform (the "Company"). The Company acts as a limited payment collection and facilitation agent, collecting fares from Guests and remitting the Host's share as set out below. This Agreement applies regardless of whether a vehicle is Self-Hosted or Fleet-Managed.</p>

          <h3 className="font-bold text-gray-900 mt-6 mb-2">1. Two Modes of Hosting</h3>
          <p className="mb-1">1.1. Self-Hosted: the Host retains full control — setting price within the market-rate band, handling handovers directly, and receiving payouts directly.</p>
          <p className="mb-4">1.2. Fleet-Managed: the Host may separately opt a vehicle into fleet management, where a Ziyam-assigned Fleet Operator handles handovers and logistics. Fleet-Managed vehicles additionally require a vehicle-specific Fleet Partner Agreement, layered on top of this one.</p>

          <h3 className="font-bold text-gray-900 mt-6 mb-2">2. Revenue Share</h3>
          <p className="mb-4">2.1. The Host retains <strong>70%</strong> of the base fare of every completed booking; the Company's commission is <strong>30%</strong>, covering payment processing, guest verification, marketing, and platform support. Applies equally to Self-Hosted and Fleet-Managed vehicles.</p>

          <h3 className="font-bold text-gray-900 mt-6 mb-2">3. Payout Timeline ("N+1" Policy)</h3>
          <p className="mb-1">3.1. Self-Hosted: released 24–48 hours after trip completion, or bundled weekly if opted in.</p>
          <p className="mb-1">3.2. Fleet-Managed: released within 1 business day of the Fleet Operator confirming receipt of cleared funds.</p>
          <p className="mb-4">3.3. No advance payouts without cleared, confirmed receipt. Payouts release only to a penny-drop verified bank account.</p>

          <h3 className="font-bold text-gray-900 mt-6 mb-2">4. Vehicle Eligibility & Documentation</h3>
          <p className="mb-4">4.1. Every listed vehicle must carry a valid RC, PUC certificate, and active comprehensive insurance policy, kept current by the Host.</p>

          <h3 className="font-bold text-gray-900 mt-6 mb-2">5. Insurance & Damage — No Platform Insurance</h3>
          <p className="mb-1">5.1. The Company is a marketplace, not an insurer. The Host's own comprehensive insurance is the primary coverage at all times.</p>
          <p className="mb-1">5.2. Guest-caused damage is recovered from the security deposit first; costs beyond the deposit are the Host's responsibility to pursue from the Guest. The Company assists with claim coordination and attempts to contribute up to ₹20,000 towards a valid claim, on a best-effort basis.</p>
          <p className="mb-4">5.3. 24/7 roadside assistance is included for every Host, regardless of protection plan or hosting mode.</p>

          <h3 className="font-bold text-gray-900 mt-6 mb-2">6. Host Conduct & KYC</h3>
          <p className="mb-4">6.1. KYC (Aadhaar OTP eKYC or Arya.ai identity document, plus driving licence) is required before any vehicle goes live. Circumventing the Platform to arrange a rental directly with a Guest voids KYC protection, driver verification, and Platform support for that trip.</p>

          <h3 className="font-bold text-gray-900 mt-6 mb-2">7. Term, Confidentiality & Liability</h3>
          <p className="mb-1">7.1. This Agreement remains in effect while the Host maintains an active account; either Party may terminate with written notice, without affecting amounts already earned.</p>
          <p className="mb-1">7.2. Both Parties keep confidential information private; the Company's trademarks, software, and platform technology remain its exclusive property.</p>
          <p className="mb-4">7.3. The Host indemnifies the Company against losses arising from the Host's willful misconduct, negligence, or breach of law. The Company is not liable for indirect or consequential damages.</p>

          <h3 className="font-bold text-gray-900 mt-6 mb-2">8. Governing Law</h3>
          <p className="mb-4">8.1. Governed by the laws of India; courts at Bengaluru, Karnataka have exclusive jurisdiction.</p>

          <h3 className="font-bold text-gray-900 mt-6 mb-2">9. Entire Agreement & Amendments</h3>
          <p className="mb-4">9.1. Together with the published Host Policy and any vehicle-specific Fleet Partner Agreement, this constitutes the entire understanding on Host onboarding. The Company may update this Agreement by posting a revised version and notifying the Host.</p>

          <p className="text-center font-bold mt-8 mb-1">IN WITNESS WHEREOF, the Parties have executed this Agreement electronically or physically.</p>
          <p className="text-center font-bold mb-6">SIGNED AND DELIVERED</p>
          <div className="grid grid-cols-2 gap-6 mt-6">
            <div className="text-center">
              <div className="h-16 border-b-2 border-gray-300 flex items-end justify-center pb-1">
                <span className="text-xs text-gray-300">For Eightlines Fleet Pvt. Ltd.</span>
              </div>
              <p className="text-xs font-semibold text-gray-500 mt-2">Company</p>
            </div>
            <div className="text-center">
              <div className="h-16 border-b-2 border-gray-300 flex items-end justify-center pb-1">
                {wetSigned || eSigned ? <span className="italic text-gray-700 text-lg">{user?.fullName}</span> : <span className="text-xs text-gray-300">Not yet signed</span>}
              </div>
              <p className="text-xs font-semibold text-gray-500 mt-2">Host</p>
              <p className="text-xs text-gray-400">{user?.fullName ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="print:hidden"><Footer /></div>
    </div>
  );
}

export default function HostAgreementPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
        <AgreementInner />
      </Suspense>
    </ProtectedRoute>
  );
}
