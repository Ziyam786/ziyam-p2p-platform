'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import Footer from '../../../../components/Footer';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { useAuth } from '../../../../lib/auth-context';
import { useToast } from '../../../../components/Toast';
import { bookingsApi } from '../../../../lib/api';
import type { Booking } from '../../../../lib/types';

const ESIGN_LABELS: Record<string, string> = {
  sign_initiated: 'Waiting for signers to start',
  sign_pending: 'Waiting for signature',
  sign_in_progress: 'Signature in progress',
  sign_complete: 'Fully signed',
};

function AgreementInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { show } = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [esignBusy, setEsignBusy] = useState(false);

  function load() {
    bookingsApi.get(params.id).then((res) => setBooking(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [params.id]);

  useEffect(() => {
    if (searchParams.get('esigned') !== '1' || !booking?.esignRequestId) return;
    bookingsApi.esignStatus(booking.id).then(() => load()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.esignRequestId]);

  async function handleStartEsign() {
    if (!booking) return;
    setEsignBusy(true);
    try {
      await bookingsApi.startEsign(booking.id);
      show('eSign request created — refresh in a moment to check status', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to start eSign', 'error');
    } finally {
      setEsignBusy(false);
    }
  }

  async function handleCheckEsignStatus() {
    if (!booking) return;
    setEsignBusy(true);
    try {
      await bookingsApi.esignStatus(booking.id);
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to check status', 'error');
    } finally {
      setEsignBusy(false);
    }
  }

  if (loading) return <p className="text-center pt-32 text-gray-400">Loading…</p>;
  if (!booking || !booking.car) return <p className="text-center pt-32 text-gray-400">Agreement not found.</p>;

  const isCustomer = user?.id === booking.customerId;
  const isHost = user?.id === booking.car.ownerId;
  if (!isCustomer && !isHost) return <p className="text-center pt-32 text-gray-400">You don't have access to this agreement.</p>;

  const host = booking.car.owner;
  const guest = booking.customer;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="print:hidden"><Navbar /></div>
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-20 print:pt-4">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <a href={`/account/trips/${booking.id}`} className="text-xs text-gray-400 hover:text-amber-500">← Back to trip</a>
          <button onClick={() => window.print()} className="text-xs font-bold bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg transition">
            Print / Save as PDF
          </button>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4 print:hidden">
          <p className="text-sm font-bold text-gray-900 mb-1">✍️ Real Aadhaar eSign</p>
          {!booking.esignRequestId ? (
            <>
              <p className="text-xs text-gray-500 mb-3">Legally sign this agreement with Aadhaar via Setu — both host and guest will get a signing link by email.</p>
              <button disabled={esignBusy} onClick={handleStartEsign} className="btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white text-sm font-bold px-5 py-2.5 rounded-xl transition">
                {esignBusy ? 'Starting…' : 'Start eSign'}
              </button>
            </>
          ) : booking.esignStatus === 'sign_complete' ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-600 font-semibold">✓ Fully signed</span>
              {booking.esignDownloadUrl && (
                <a href={booking.esignDownloadUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg transition">
                  Download Signed PDF
                </a>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-amber-600 font-semibold">{ESIGN_LABELS[booking.esignStatus ?? ''] ?? 'In progress'}</span>
              <button disabled={esignBusy} onClick={handleCheckEsignStatus} className="text-xs font-bold border border-gray-200 hover:border-amber-400 px-4 py-2 rounded-lg transition">
                {esignBusy ? 'Checking…' : 'Refresh Status'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 sm:p-10 text-sm text-gray-700 leading-relaxed print:border-0 print:rounded-none">
          <h1 className="text-xl font-extrabold text-gray-900 text-center mb-1">LEASE AGREEMENT FOR CAR SHARING</h1>
          <p className="text-center text-xs text-gray-400 mb-6">Agreement ID: LA-{booking.id.slice(0, 8).toUpperCase()}</p>

          <p className="mb-4">
            This Vehicle Lease Agreement (the "<strong>Agreement</strong>") is made and effective from{' '}
            <strong>{new Date(booking.createdAt).toLocaleString()}</strong> (the "Effective Date"), as reflected in the
            booking details on the ZiyamSelfDrive platform ("<strong>Platform</strong>", operated by Eightlines Fleet
            Private Limited).
          </p>

          <p className="text-center font-bold my-4">BETWEEN</p>
          <p className="mb-4">
            <strong>{host?.fullName ?? '—'}</strong> (hereinafter referred to as the "Host" or "Lessor"), the registered
            owner of — or duly authorized to list — the vehicle bearing registration number{' '}
            <strong>{booking.car.registrationNo}</strong> ("the Vehicle").
          </p>
          <p className="text-center font-bold my-4">AND</p>
          <p className="mb-4">
            <strong>{guest?.fullName ?? '—'}</strong> (hereinafter referred to as the "Guest" or "Lessee"), who has
            placed a request through the Platform bearing booking ID <strong>{booking.id}</strong>.
          </p>

          <p className="mb-4">
            The Host and the Guest shall be hereinafter collectively referred to as "Parties" and individually as a
            "Party".
          </p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">1. Vehicle & Trip Details</h2>
          <table className="w-full border border-gray-200 rounded-lg overflow-hidden mb-4">
            <tbody className="divide-y divide-gray-100">
              <Row label="Vehicle" value={`${booking.car.make} ${booking.car.model} (${booking.car.year})`} />
              <Row label="Registration No." value={booking.car.registrationNo} />
              <Row label="Rental Period" value={`${new Date(booking.startTime).toLocaleString()} → ${new Date(booking.endTime).toLocaleString()}`} />
              <Row label="Protection Plan" value={booking.protectionPlan} />
              <Row label="Total Amount" value={`₹${booking.totalAmount.toLocaleString('en-IN')}`} />
            </tbody>
          </table>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">2. Permitted Territory</h2>
          <p className="mb-4">
            The entire territory of India, excluding any travel to connected countries including but not limited to
            Nepal, Bhutan, Bangladesh, or Pakistan, unless separately agreed in writing with the Host.
          </p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">3. Obligations</h2>
          <p className="mb-4">
            The Guest agrees to operate the Vehicle in accordance with the Motor Vehicles Act, 1988, return it in the
            condition received (ordinary wear and tear excepted), and bear responsibility for any traffic violations,
            tolls, or fines incurred during the rental period. The Host warrants the Vehicle is roadworthy, insured,
            and free of undisclosed defects at handover.
          </p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">4. Signatures</h2>
          <div className="grid grid-cols-2 gap-6 mt-6">
            <SignatureBlock role="Host / Lessor" name={host?.fullName} signed={Boolean(host?.signatureUrl)} />
            <SignatureBlock role="Guest / Lessee" name={guest?.fullName} signed={Boolean(guest?.signatureUrl)} />
          </div>

          <p className="text-xs text-gray-400 mt-8 text-center">
            This is a system-generated agreement. {(!host?.signatureUrl || !guest?.signatureUrl) && 'Add your signature from Account → Verification Checklist for it to appear here.'}
          </p>
        </div>
      </div>
      <div className="print:hidden"><Footer /></div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="px-4 py-2.5 bg-gray-50 font-semibold text-gray-500 text-xs uppercase tracking-wider w-1/3">{label}</td>
      <td className="px-4 py-2.5 text-gray-800">{value}</td>
    </tr>
  );
}

function SignatureBlock({ role, name, signed }: { role: string; name?: string; signed: boolean }) {
  return (
    <div className="text-center">
      <div className="h-16 border-b-2 border-gray-300 flex items-end justify-center pb-1">
        {signed ? <span className="italic text-gray-700 text-lg">{name}</span> : <span className="text-xs text-gray-300">Not yet signed</span>}
      </div>
      <p className="text-xs font-semibold text-gray-500 mt-2">{role}</p>
      <p className="text-xs text-gray-400">{name ?? '—'}</p>
    </div>
  );
}

export default function AgreementPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
        <AgreementInner />
      </Suspense>
    </ProtectedRoute>
  );
}
