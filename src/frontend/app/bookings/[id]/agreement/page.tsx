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

const PENALTY_SCHEDULE: [string, string][] = [
  ['Unauthorized Driver / Handover to Third Party', '₹10,000/- + Immediate Termination'],
  ['Tampering with Dashcam or OBD Port (GPS)', '₹12,500/-'],
  ['Loss of or Damage to Vehicle Keys', '₹10,000/- + lock system cost (up to ₹75,000)'],
  ['Loss of Original Vehicle Documents', '₹10,000/-'],
  ['Overspeeding (above 100 km/h)', '₹2,500/- per instance'],
  ['Harsh Braking (>3 instances per 5km after a 2km grace period, telematics-tracked)', '₹1,000/-'],
  ['Rapid Acceleration / Rash Driving (>3 instances per 5km after a 2km grace period)', '₹2,000/-'],
  ['DUI / Reckless Driving', '100% of all costs + legal action'],
  ['Smoking or Alcohol Consumption inside Vehicle', '₹1,250/-'],
  ['Exterior Washing Required (dirt/mud)', '₹500/-'],
  ['Interior Cleaning (spills, stains, trash)', '₹700/- to ₹1,500/- (severity-based)'],
];

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
          <p className="text-center font-extrabold text-gray-900">EIGHTLINESFLEET</p>
          <p className="text-center text-xs text-gray-400 mb-1">Vehicle Rental Services — Bengaluru, Karnataka</p>
          <h1 className="text-xl font-extrabold text-gray-900 text-center mb-1">LEASE AGREEMENT FOR CAR SHARING</h1>
          <p className="text-center text-xs text-gray-400 mb-6">Agreement ID: LA-{booking.id.slice(0, 8).toUpperCase()}</p>

          <p className="text-xs italic text-gray-500 mb-4">
            This document is an electronic record in terms of the Information Technology Act, 2000, and rules
            thereunder as applicable, along with the amended provisions pertaining to electronic records in various
            statutes. This electronic record is generated by a computer system and does not require physical
            signatures. This Agreement is also subject to the Indian Contract Act, 1872 and the Digital Personal Data
            Protection Act, 2023 insofar as it involves the collection and processing of KYC documents,
            GPS/telematics data, and trip records.
          </p>

          <p className="mb-4">
            This lease agreement between the Host and Guest records the terms and conditions regarding the lease of
            the vehicle by the Host to the Guest. This lease agreement adheres to the provisions outlined in Section
            51 of the Motor Vehicles Act, 1988, recognizing leasing, hire-purchase, and hypothecation of vehicles for
            personal use.
          </p>
          <p className="mb-4">
            This Lease Agreement for Car Sharing is made and effective from ("Effective Date" or the "Booking Start
            Date") <strong>{new Date(booking.startTime).toLocaleString()}</strong> to End date{' '}
            <strong>{new Date(booking.endTime).toLocaleString()}</strong>, as reflected in the booking details on the
            App (the "Agreement").
          </p>

          <p className="text-center font-bold my-4">BETWEEN</p>
          <p className="mb-4">
            <strong>{host?.fullName ?? '—'}</strong> (hereinafter referred to as the "Host" or "Lessor"), which
            expression shall, unless repugnant to the context or meaning thereof, be deemed to include his/her heirs,
            legal representatives, and permitted assigns, of the ONE PART;
          </p>
          <p className="text-center font-bold my-4">AND</p>
          <p className="mb-4">
            <strong>{guest?.fullName ?? '—'}</strong> (hereinafter referred to as the "Guest" or "Lessee"), which
            expression shall, unless repugnant to the context or meaning thereof, be deemed to include his/her heirs,
            legal representatives, and permitted assigns, of the OTHER PART.
          </p>
          <p className="text-xs italic text-gray-500 mb-4">
            (The Host and the Guest shall be hereinafter collectively referred to as the "Parties" and individually
            as the "Party").
          </p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">WHEREAS</h2>
          <p className="mb-1">a. The Host is the sole legal, beneficial, and registered owner of the vehicle bearing registration number <strong>{booking.car.registrationNo}</strong>{booking.car.chassis ? <> with Chassis No. <strong>{booking.car.chassis}</strong></> : null} ("Vehicle").</p>
          <p className="mb-1">b. The Host has listed the Vehicle for leasing on the Platform (defined below) subject to the terms and conditions specified therein.</p>
          <p className="mb-1">c. The Guest, a user of the Platform, has placed a request through the Platform/App for the lease of the Vehicle, bearing booking id — <strong>{booking.id}</strong></p>
          <p className="mb-4">d. The Lessor is willing to lease the Vehicle to the Guest, subject to the terms and conditions of this Agreement and the policies stipulated upon the Platform.</p>
          <p className="font-bold text-xs mb-4">NOW, THEREFORE, IN CONSIDERATION OF THE FOREGOING AND THE COVENANTS AND CONDITIONS CONTAINED HEREIN, THE PARTIES HEREBY AGREE AS FOLLOWS:</p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">1. Definitions and Interpretation</h2>
          <p className="mb-1">1.1. "Applicable Laws" means all statutes, including the Motor Vehicles Act, 1988 ("MVA"), and rules made thereunder.</p>
          <p className="mb-1">1.2. "Permitted Territory" shall mean the territory of India, excluding Ladakh and foreign countries (Nepal, Bhutan, etc.).</p>
          <p className="mb-4">1.3. "Prohibited Use" includes commercial usage, racing, rallying, or usage by any person other than the Lessee.</p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">2. Grant of Lease and Possession</h2>
          <p className="mb-1">2.1. The Lessor hereby grants the Lessee a lease of the Vehicle for the Booking Period defined in the App.</p>
          <p className="mb-4">2.2. The Lessee acknowledges that this Agreement constitutes a transfer of possession and control of the Vehicle for the lease period, but not ownership. The Lessor remains the registered owner.</p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">3. Strict Usage Policy & Unauthorized Drivers</h2>
          <p className="mb-1">3.1. Personal Use Only: The Vehicle is strictly for the personal use of the Lessee.</p>
          <p className="mb-1">3.2. Authorized Driver: The Vehicle must be driven ONLY by the Lessee named in this Agreement.</p>
          <p className="mb-3">3.3. Prohibition on Sub-Leasing: Handing over the vehicle to any third party (friends, family, or unregistered drivers) is strictly prohibited.</p>
          <p className="mb-3 font-bold text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            PENALTY: If the Vehicle is found to be driven by anyone other than the Lessee, a non-negotiable penalty of
            ₹10,000/- (Rupees Ten Thousand Only) shall be levied immediately, and the lease shall be terminated.
          </p>
          <p className="mb-4">
            The vehicle shall be driven exclusively by the Lessee. Driving by any unauthorized individual or transfer
            of the vehicle to a third party is strictly prohibited. The Lessee's driver details are verified via the
            Platform's KYC process (DigiLocker / Aadhaar-based verification), and the insurance policy is issued
            based on the verified driver information. In the event of any damage or incident, insurance claims may be
            denied if the vehicle is operated by a person other than the authorized Lessee.
          </p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">4. Schedule of Penalties & Liquidated Damages</h2>
          <p className="mb-3">The Lessee acknowledges that the following amounts are agreed pre-estimates of damages and costs incurred by the Lessor for violations. The Lessee agrees to pay these immediately upon demand:</p>
          <table className="w-full border border-gray-200 rounded-lg overflow-hidden mb-4 text-xs">
            <tbody className="divide-y divide-gray-100">
              {PENALTY_SCHEDULE.map(([label, amount]) => (
                <tr key={label}>
                  <td className="px-3 py-2 text-gray-700">{label}</td>
                  <td className="px-3 py-2 text-gray-900 font-semibold text-right whitespace-nowrap">{amount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">5. Vehicle Integrity & Equipment</h2>
          <p className="mb-1">5.1. Dashcam & GPS: The Lessee agrees not to obstruct, unplug, or tamper with the Dashcam or On-Board Diagnostics (OBD) port. Tampering is considered a malicious attempt to hide vehicle misuse and attracts the fine mentioned in Clause 4.</p>
          <p className="mb-4">5.2. Documents: The Lessee acknowledges receipt of original or certified copies of the RC, Insurance, and PUC. Loss of these documents attracts the penalty mentioned above.</p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">6. Insurance & Liability</h2>
          <p className="mb-1">6.1. Third-Party Liability: The Lessor maintains insurance strictly for Third-Party Liability as required by the MVA.</p>
          <p className="mb-4">6.2. Lessee's Liability (Own Damage): The Lessee is 100% financially liable for: any damage to the Vehicle ("Own Damage") during the lease term; theft of the Vehicle if caused by negligence (e.g., leaving keys in the car); and any claims denied by the insurance company due to the Lessee's intoxication, lack of valid license, or violation of traffic rules.</p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">7. Security Deposit</h2>
          <p className="mb-4">
            A refundable security deposit of <strong>₹{booking.car.securityDeposit.toLocaleString('en-IN')}</strong>{' '}
            has been collected via the Platform and is held in escrow. It shall be released to the Guest after a
            clean return of the Vehicle, less any deductions for damages, penalties, or charges due under this
            Agreement, in accordance with the Platform's published Refund &amp; Cancellation Policy.
          </p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">8. Return of Vehicle</h2>
          <p className="mb-1">8.1. The Lessee shall return the vehicle in the same condition as received.</p>
          <p className="mb-4">8.2. Fuel Policy: The vehicle must be returned with the same fuel level. Shortage is charged at ₹100 per 10km-equivalent shortage; excess fuel is non-refundable.</p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">9. Indemnity</h2>
          <p className="mb-4">The Lessee agrees to indemnify and hold the Lessor harmless against any claims, fines (challans), or legal actions arising from the Lessee's use of the Vehicle during the Lease Term.</p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">10. Governing Law & Dispute Resolution</h2>
          <p className="mb-4">
            This Agreement shall be governed by and construed in accordance with the laws of India. Subject to the
            Platform's grievance redressal process, the courts at Bengaluru, Karnataka shall have exclusive
            jurisdiction over any disputes arising out of or in connection with this Agreement.
          </p>

          <h2 className="font-bold text-gray-900 mt-6 mb-2">Booking Summary</h2>
          <table className="w-full border border-gray-200 rounded-lg overflow-hidden mb-4">
            <tbody className="divide-y divide-gray-100">
              <Row label="Vehicle" value={`${booking.car.make} ${booking.car.model} (${booking.car.year})`} />
              <Row label="Registration No." value={booking.car.registrationNo} />
              {booking.car.chassis && <Row label="Chassis No." value={booking.car.chassis} />}
              <Row label="Rental Period" value={`${new Date(booking.startTime).toLocaleString()} → ${new Date(booking.endTime).toLocaleString()}`} />
              <Row label="Protection Plan" value={booking.protectionPlan} />
              <Row label="Total Amount" value={`₹${booking.totalAmount.toLocaleString('en-IN')}`} />
            </tbody>
          </table>

          <p className="text-center font-bold mt-8 mb-1">IN WITNESS WHEREOF, the Parties have executed this Agreement electronically or physically as of the Effective Date.</p>
          <p className="text-center font-bold mb-6">SIGNED AND DELIVERED</p>
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
