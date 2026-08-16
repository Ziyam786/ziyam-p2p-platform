'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ProtectedRoute from '../../../components/ProtectedRoute';
import BottomNav from '../../../components/BottomNav';
import LoadingScreen from '../../../components/LoadingScreen';
import SignaturePad from '../../../components/SignaturePad';
import { useToast } from '../../../components/Toast';
import { ApiError, cashLogApi, opsTripApi, openWhatsApp, uploadFile } from '../../../lib/api';
import type { OpsTripHandoverPayload, OpsTripCheckOutPayload } from '../../../lib/api';
import type { OpsTripRow } from '../../../lib/types';

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api').replace(/\/api$/, '');
function fileUrl(url?: string | null): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function inr(n?: number | null) {
  return n == null ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-amber-500/10 text-amber-400',
  RUNNING: 'bg-blue-500/10 text-blue-400',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
};

const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';
const ADDON_TYPES = ['Washing', 'Damages', 'Fine or Penalty', 'Waiting Charges', 'Toll', 'Extra KMs', 'Other'];
const DECISION_OPTIONS = ['Returned on time', 'Extended', 'Dispute raised', 'Other'];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, subtitle, children, sectionRef }: {
  title: string; subtitle?: string; children: React.ReactNode; sectionRef?: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div ref={sectionRef} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="font-bold text-slate-100">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Thumb({ url, onRemove }: { url: string; onRemove?: () => void }) {
  return (
    <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
      <Image src={fileUrl(url)} alt="" fill sizes="80px" className="object-cover" />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/70 text-white text-xs leading-none"
          aria-label="Remove photo"
        >
          ×
        </button>
      )}
    </div>
  );
}

function TripDetailInner() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const { show } = useToast();

  const [trip, setTrip] = useState<OpsTripRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  function load() {
    setLoading(true);
    opsTripApi
      .get(id)
      .then((res) => setTrip(res.data))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else show(err instanceof ApiError ? err.message : 'Failed to load trip', 'error');
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  // ---- WhatsApp resend ----
  const [waLoading, setWaLoading] = useState<string | null>(null);
  async function handleWhatsApp(kind: 'bookingConfirmation' | 'handoverConfirmation' | 'returnReminder') {
    if (!trip) return;
    setWaLoading(kind);
    try {
      const res = await opsTripApi.whatsappTemplates(trip.id);
      openWhatsApp(trip.customerMobile, res.data[kind]);
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to load message template', 'error');
    } finally {
      setWaLoading(null);
    }
  }

  // ---- Handover form state ----
  const [idTab, setIdTab] = useState<'photo' | 'digilocker'>('photo');
  const [maskedIdPhotoUrl, setMaskedIdPhotoUrl] = useState<string | null>(null);
  const [maskedIdUploading, setMaskedIdUploading] = useState(false);
  const [dlFrontUrl, setDlFrontUrl] = useState<string | null>(null);
  const [dlBackUrl, setDlBackUrl] = useState<string | null>(null);
  const [dlFrontUploading, setDlFrontUploading] = useState(false);
  const [dlBackUploading, setDlBackUploading] = useState(false);
  const [dlNumber, setDlNumber] = useState('');

  const [digilockerStarting, setDigilockerStarting] = useState(false);
  const [digilockerPolling, setDigilockerPolling] = useState(false);
  const [digilockerAuthenticated, setDigilockerAuthenticated] = useState(false);
  const [digilockerName, setDigilockerName] = useState<string | null>(null);
  const [digilockerAddress, setDigilockerAddress] = useState<string | null>(null);
  const [digilockerError, setDigilockerError] = useState<string | null>(null);

  const [vehiclePhotoUrls, setVehiclePhotoUrls] = useState<string[]>([]);
  const [vehiclePhotoUploading, setVehiclePhotoUploading] = useState(false);

  const signatureBlobRef = useRef<Blob | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const [depositCollected, setDepositCollected] = useState('');
  const [depositPaymentMode, setDepositPaymentMode] = useState<'CASH' | 'ONLINE'>('CASH');
  const [saveIdentityToVault, setSaveIdentityToVault] = useState(true);

  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);

  const initializedHandoverRef = useRef(false);
  useEffect(() => {
    if (!trip || initializedHandoverRef.current) return;
    initializedHandoverRef.current = true;
    setDepositCollected(trip.depositAmount != null ? String(trip.depositAmount) : '');
  }, [trip]);

  // DigiLocker return-trip polling — the redirect lands back on this exact page with ?digilocker=1.
  const digilockerPollStartedRef = useRef(false);
  useEffect(() => {
    if (!trip || digilockerPollStartedRef.current) return;
    if (searchParams.get('digilocker') !== '1') return;
    digilockerPollStartedRef.current = true;
    setIdTab('digilocker');
    setDigilockerPolling(true);

    let cancelled = false;
    let attempts = 0;

    async function poll() {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await opsTripApi.digilockerStatus(id);
        if (res.data.status === 'authenticated') {
          setDigilockerAuthenticated(true);
          setDigilockerName(res.data.name ?? null);
          setDigilockerAddress(res.data.address ?? null);
          setDigilockerPolling(false);
          return;
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 503) {
          setDigilockerError("DigiLocker isn't configured on this deployment yet — use Masked ID Photo instead.");
          setDigilockerPolling(false);
          return;
        }
        // Transient errors are swallowed — polling continues until attempts run out.
      }
      if (attempts < 10 && !cancelled) {
        setTimeout(poll, 2000);
      } else if (!cancelled) {
        setDigilockerPolling(false);
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [trip, id, searchParams]);

  async function handleMaskedIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMaskedIdUploading(true);
    try {
      const url = await uploadFile(file, file.name);
      setMaskedIdPhotoUrl(url);
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    } finally {
      setMaskedIdUploading(false);
    }
  }

  async function handleDlFileChange(side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const setUploading = side === 'front' ? setDlFrontUploading : setDlBackUploading;
    const setUrl = side === 'front' ? setDlFrontUrl : setDlBackUrl;
    setUploading(true);
    try {
      const url = await uploadFile(file, file.name);
      setUrl(url);
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleDigilockerStart() {
    if (!trip) return;
    setDigilockerStarting(true);
    setDigilockerError(null);
    try {
      const res = await opsTripApi.digilockerStart(trip.id);
      window.location.href = res.data.url;
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setDigilockerError("DigiLocker isn't configured on this deployment yet — use Masked ID Photo instead.");
      } else {
        show(err instanceof ApiError ? err.message : 'Failed to start DigiLocker verification', 'error');
      }
    } finally {
      setDigilockerStarting(false);
    }
  }

  async function handleVehiclePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (vehiclePhotoUrls.length >= 7) {
      show('Maximum 7 vehicle photos', 'error');
      return;
    }
    setVehiclePhotoUploading(true);
    try {
      const url = await uploadFile(file, file.name);
      setVehiclePhotoUrls((prev) => [...prev, url]);
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Upload failed', 'error');
    } finally {
      setVehiclePhotoUploading(false);
    }
  }

  function removeVehiclePhoto(url: string) {
    setVehiclePhotoUrls((prev) => prev.filter((u) => u !== url));
  }

  const idVerified = Boolean(maskedIdPhotoUrl) || digilockerAuthenticated;
  const canSubmitHandover = idVerified && hasSignature && !handoverSubmitting;

  async function handleCompleteHandover() {
    if (!trip) return;
    if (!idVerified) {
      setHandoverError('Verify the customer’s ID (Masked ID Photo or DigiLocker) before completing handover.');
      return;
    }
    if (!hasSignature || !signatureBlobRef.current) {
      setHandoverError('Capture the customer’s signature before completing handover.');
      return;
    }
    setHandoverError(null);
    setHandoverSubmitting(true);
    try {
      const signatureUrl = await uploadFile(signatureBlobRef.current, 'signature.png');
      const payload: OpsTripHandoverPayload = {
        idVerificationMethod: digilockerAuthenticated ? 'DIGILOCKER' : maskedIdPhotoUrl ? 'MASKED_PHOTO' : undefined,
        maskedIdPhotoUrl: maskedIdPhotoUrl ?? undefined,
        dlFrontUrl: dlFrontUrl ?? undefined,
        dlBackUrl: dlBackUrl ?? undefined,
        dlNumber: dlNumber.trim() || undefined,
        customerSignatureUrl: signatureUrl,
        vehiclePhotoUrls: vehiclePhotoUrls.length ? vehiclePhotoUrls : undefined,
        depositCollected: depositCollected ? Number(depositCollected) : undefined,
        depositPaymentMode,
        saveIdentityToVault,
      };
      await opsTripApi.handover(trip.id, payload);
      show('Handover completed', 'success');
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to complete handover', 'error');
    } finally {
      setHandoverSubmitting(false);
    }
  }

  // ---- Return form state ----
  const [odometerEnd, setOdometerEnd] = useState('');
  const [fuelEst, setFuelEst] = useState('');
  const [tyreHealth, setTyreHealth] = useState('');
  const [carWashed, setCarWashed] = useState(false);
  const [washingCharges, setWashingCharges] = useState('');
  const [newDamages, setNewDamages] = useState('');
  const [addonLines, setAddonLines] = useState<{ type: string; amount: string; note: string }[]>([]);
  const [amountCollected, setAmountCollected] = useState('');
  const [amountPaidGuest, setAmountPaidGuest] = useState('');
  const [customerDecision, setCustomerDecision] = useState('');
  const [customerDecisionOther, setCustomerDecisionOther] = useState('');
  const [refundDeposit, setRefundDeposit] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const [pendingCashLog, setPendingCashLog] = useState<number | null>(null);
  const [cashLogging, setCashLogging] = useState(false);

  function addAddonLine() {
    setAddonLines((prev) => [...prev, { type: ADDON_TYPES[0], amount: '', note: '' }]);
  }
  function updateAddonLine(idx: number, patch: Partial<{ type: string; amount: string; note: string }>) {
    setAddonLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeAddonLine(idx: number) {
    setAddonLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const rangeKm = trip?.odometerStart != null && odometerEnd ? Number(odometerEnd) - trip.odometerStart : null;

  async function handleCompleteReturn() {
    if (!trip) return;
    setReturnSubmitting(true);
    try {
      const finalDecision = customerDecision === 'Other' ? (customerDecisionOther.trim() || 'Other') : customerDecision || undefined;
      const payload: OpsTripCheckOutPayload = {
        endTime: new Date().toISOString(),
        odometerEnd: odometerEnd ? Number(odometerEnd) : undefined,
        fuelEst: fuelEst.trim() || undefined,
        carWashed,
        washingCharges: carWashed && washingCharges ? Number(washingCharges) : undefined,
        tyreHealth: tyreHealth.trim() || undefined,
        newDamages: newDamages.trim() || undefined,
        amountCollected: amountCollected ? Number(amountCollected) : undefined,
        amountPaidGuest: amountPaidGuest ? Number(amountPaidGuest) : undefined,
        checkoutAddons: addonLines
          .filter((l) => l.amount)
          .map((l) => ({ type: l.type, amount: Number(l.amount), note: l.note.trim() || undefined })),
        customerDecision: finalDecision,
        refundDeposit,
      };
      await opsTripApi.checkOut(trip.id, payload);
      show('Trip checked out', 'success');
      const collected = amountCollected ? Number(amountCollected) : 0;
      if (collected > 0) setPendingCashLog(collected);
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to check out', 'error');
    } finally {
      setReturnSubmitting(false);
    }
  }

  async function handleLogCash() {
    if (!trip || pendingCashLog == null) return;
    setCashLogging(true);
    try {
      await cashLogApi.create({ type: 'CASH_IN', amount: pendingCashLog, category: 'Booking Collection', tripId: trip.id });
      show('Logged to cash counter', 'success');
      setPendingCashLog(null);
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to log cash', 'error');
    } finally {
      setCashLogging(false);
    }
  }

  // Deep-link scroll — Home links to `?step=handover` / `?step=checkout`.
  const handoverSectionRef = useRef<HTMLDivElement>(null);
  const returnSectionRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (!trip || scrolledRef.current) return;
    const step = searchParams.get('step');
    if (step === 'handover' && handoverSectionRef.current) {
      scrolledRef.current = true;
      handoverSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (step === 'checkout' && returnSectionRef.current) {
      scrolledRef.current = true;
      returnSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [trip, searchParams]);

  if (loading) return <LoadingScreen label="Loading trip…" />;

  if (notFound || !trip) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4 pb-24 gap-3">
        <p className="text-slate-400">Trip not found.</p>
        <Link href="/bookings" className="text-brand-400 hover:text-brand-300 text-sm font-semibold">Back to Trips</Link>
        <BottomNav />
      </div>
    );
  }

  const showHandoverForm = trip.status === 'RUNNING' && !trip.customerSignatureUrl;
  const showReturnForm = trip.status === 'RUNNING' && Boolean(trip.customerSignatureUrl);
  const showReadOnlySummary = trip.status === 'COMPLETED' || trip.status === 'CANCELLED';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="border-b border-slate-800 px-4 py-4 flex items-center gap-3">
        <Link href="/bookings" className="text-slate-400 hover:text-white text-xl leading-none" aria-label="Back">←</Link>
        <div className="min-w-0">
          <h1 className="font-extrabold text-lg truncate">{trip.tripCode ?? 'Trip'}</h1>
          <p className="text-xs text-slate-500">Trip Detail</p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        {/* Header card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-lg truncate">{trip.customerName}</p>
              <p className="text-xs text-slate-500 mt-0.5">{trip.customerMobile}</p>
              <div className="flex items-center gap-4 mt-2 text-xs font-semibold">
                <a href={`tel:${trip.customerMobile}`} className="text-brand-400 hover:text-brand-300">Call</a>
                <a href={`sms:${trip.customerMobile}`} className="text-brand-400 hover:text-brand-300">SMS</a>
                <button type="button" onClick={() => openWhatsApp(trip.customerMobile, `Hi ${trip.customerName}, this is Ziyam Self Drive.`)} className="text-emerald-400 hover:text-emerald-300">
                  WhatsApp
                </button>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLES[trip.status] ?? 'bg-slate-800 text-slate-400'}`}>
              {trip.status}
            </span>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="font-semibold text-sm">
              {trip.car ? `${trip.car.make} ${trip.car.model}` : trip.carId}
              <span className="text-slate-500 font-normal"> · {trip.car?.registrationNo}</span>
            </p>
            {trip.baseFare != null && <p className="text-xs text-slate-500 mt-0.5">{inr(trip.baseFare)}/day</p>}
          </div>
        </div>

        {/* Cash log prompt after a fresh checkout */}
        {pendingCashLog != null && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-emerald-300">Log the {inr(pendingCashLog)} collected to the cash counter?</p>
            <button
              type="button"
              disabled={cashLogging}
              onClick={handleLogCash}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition shrink-0"
            >
              {cashLogging ? 'Logging…' : `Log ${inr(pendingCashLog)}`}
            </button>
          </div>
        )}

        {/* WhatsApp resend */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-bold text-sm mb-3">Resend on WhatsApp</h2>
          <div className="grid grid-cols-1 gap-2">
            {([
              ['bookingConfirmation', 'Booking Confirmation'],
              ['handoverConfirmation', 'Handover Confirmation'],
              ['returnReminder', 'Return Reminder'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                disabled={waLoading === key}
                onClick={() => handleWhatsApp(key)}
                className="text-sm font-semibold text-left bg-slate-950 border border-slate-800 hover:border-emerald-600 rounded-xl px-4 py-3 transition disabled:opacity-50"
              >
                {waLoading === key ? 'Opening WhatsApp…' : `📲 ${label}`}
              </button>
            ))}
          </div>
        </div>

        {trip.status === 'SCHEDULED' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-sm text-amber-300">
            This trip is scheduled and hasn&apos;t started yet.
          </div>
        )}

        {showHandoverForm && (
          <Section sectionRef={handoverSectionRef} title="Complete Handover" subtitle="ID verification, vehicle condition, and signature before handing over the keys.">
            {/* ID Verification */}
            <div>
              <div className="flex gap-1 border-b border-slate-800 mb-3">
                {(['photo', 'digilocker'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setIdTab(t)}
                    className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
                      idTab === t ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === 'photo' ? 'Masked ID Photo' : 'DigiLocker'}
                  </button>
                ))}
              </div>

              {idTab === 'photo' ? (
                <div className="space-y-2">
                  <input type="file" accept="image/*" capture="environment" onChange={handleMaskedIdChange} className="text-xs text-slate-400" />
                  {maskedIdUploading && <p className="text-xs text-slate-500">Uploading…</p>}
                  {maskedIdPhotoUrl && (
                    <div className="flex items-center gap-3">
                      <Thumb url={maskedIdPhotoUrl} onRemove={() => setMaskedIdPhotoUrl(null)} />
                      <p className="text-xs text-emerald-400">✓ ID photo uploaded</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {digilockerAuthenticated ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300">
                      <p className="font-semibold">✓ DigiLocker verified</p>
                      {digilockerName && <p className="mt-1">{digilockerName}</p>}
                      {digilockerAddress && <p className="text-emerald-400/80">{digilockerAddress}</p>}
                    </div>
                  ) : digilockerError ? (
                    <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">{digilockerError}</p>
                  ) : digilockerPolling ? (
                    <p className="text-xs text-slate-500">Waiting for DigiLocker confirmation…</p>
                  ) : (
                    <button
                      type="button"
                      disabled={digilockerStarting}
                      onClick={handleDigilockerStart}
                      className="text-xs font-bold bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition"
                    >
                      {digilockerStarting ? 'Starting…' : 'Verify with DigiLocker'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Driving License */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Driving License</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Front (required)</p>
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => handleDlFileChange('front', e)} className="text-xs text-slate-400" />
                  {dlFrontUploading && <p className="text-xs text-slate-500 mt-1">Uploading…</p>}
                  {dlFrontUrl && <div className="mt-2"><Thumb url={dlFrontUrl} onRemove={() => setDlFrontUrl(null)} /></div>}
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Back (optional)</p>
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => handleDlFileChange('back', e)} className="text-xs text-slate-400" />
                  {dlBackUploading && <p className="text-xs text-slate-500 mt-1">Uploading…</p>}
                  {dlBackUrl && <div className="mt-2"><Thumb url={dlBackUrl} onRemove={() => setDlBackUrl(null)} /></div>}
                </div>
              </div>
              <Field label="License Number">
                <input value={dlNumber} onChange={(e) => setDlNumber(e.target.value)} className={inputCls} placeholder="Optional" />
              </Field>
            </div>

            {/* Vehicle condition photos */}
            <div className="pt-3 border-t border-slate-800">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Vehicle Condition Photos ({vehiclePhotoUrls.length}/7)</p>
              <div className="flex flex-wrap gap-3">
                {vehiclePhotoUrls.map((url) => (
                  <Thumb key={url} url={url} onRemove={() => removeVehiclePhoto(url)} />
                ))}
                {vehiclePhotoUrls.length < 7 && (
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-2xl cursor-pointer hover:border-slate-500 shrink-0">
                    {vehiclePhotoUploading ? '…' : '+'}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleVehiclePhotoChange} disabled={vehiclePhotoUploading} />
                  </label>
                )}
              </div>
            </div>

            {/* Signature */}
            <div className="pt-3 border-t border-slate-800">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Customer Signature</p>
              <SignaturePad
                onCapture={(blob) => { signatureBlobRef.current = blob; setHasSignature(true); }}
                onClear={() => { signatureBlobRef.current = null; setHasSignature(false); }}
              />
            </div>

            {/* Deposit */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <Field label="Deposit Collected (₹)">
                <input type="number" min={0} value={depositCollected} onChange={(e) => setDepositCollected(e.target.value)} className={inputCls} />
              </Field>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Payment Mode</p>
                <div className="flex gap-2">
                  {(['CASH', 'ONLINE'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDepositPaymentMode(mode)}
                      className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition ${
                        depositPaymentMode === mode ? 'bg-brand-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-400'
                      }`}
                    >
                      {mode === 'CASH' ? 'Cash' : 'Online'}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={saveIdentityToVault} onChange={(e) => setSaveIdentityToVault(e.target.checked)} className="w-4 h-4 accent-brand-500" />
                Remember this customer&apos;s ID for faster check-in next time
              </label>
            </div>

            {handoverError && <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-4 py-3">{handoverError}</p>}

            <button
              type="button"
              disabled={!canSubmitHandover}
              onClick={handleCompleteHandover}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl transition"
            >
              {handoverSubmitting ? 'Completing handover…' : 'Complete Handover'}
            </button>
          </Section>
        )}

        {showReturnForm && (
          <Section sectionRef={returnSectionRef} title="Record Return" subtitle="Vehicle condition and payment reconciliation at drop-off.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Odometer End (km)">
                <input type="number" min={0} value={odometerEnd} onChange={(e) => setOdometerEnd(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Fuel Level">
                <input value={fuelEst} onChange={(e) => setFuelEst(e.target.value)} placeholder="e.g. Full, 3/4, 1/2" className={inputCls} />
              </Field>
            </div>
            {rangeKm != null && <p className="text-xs text-slate-500">Range: {rangeKm} km</p>}

            <Field label="Tyre Health">
              <input value={tyreHealth} onChange={(e) => setTyreHealth(e.target.value)} placeholder="Good / Needs Attention" className={inputCls} />
            </Field>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Car Washed?</p>
              <div className="flex gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setCarWashed(v)}
                    className={`flex-1 text-sm font-semibold py-2.5 rounded-lg transition ${
                      carWashed === v ? 'bg-brand-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-400'
                    }`}
                  >
                    {v ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
            {carWashed && (
              <Field label="Washing Charges (₹)">
                <input type="number" min={0} value={washingCharges} onChange={(e) => setWashingCharges(e.target.value)} className={inputCls} />
              </Field>
            )}

            <Field label="New Damages">
              <textarea value={newDamages} onChange={(e) => setNewDamages(e.target.value)} rows={3} className={inputCls} placeholder="Optional notes" />
            </Field>

            {/* Checkout Add-ons */}
            <div className="pt-3 border-t border-slate-800">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Checkout Add-ons</p>
              <div className="space-y-2">
                {addonLines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <select value={line.type} onChange={(e) => updateAddonLine(idx, { type: e.target.value })} className={`${inputCls} flex-1`}>
                      {ADDON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input
                      type="number" min={0} value={line.amount} onChange={(e) => updateAddonLine(idx, { amount: e.target.value })}
                      placeholder="₹" className={`${inputCls} w-24`}
                    />
                    <button type="button" onClick={() => removeAddonLine(idx)} className="text-slate-500 hover:text-red-400 text-lg leading-none px-2 py-2.5" aria-label="Remove line">×</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addAddonLine} className="mt-2 text-xs font-semibold text-brand-400 hover:text-brand-300">
                + Add line
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount Collected (₹)">
                <input type="number" min={0} value={amountCollected} onChange={(e) => setAmountCollected(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Amount Paid by Guest (₹)" hint="e.g. deposit refund">
                <input type="number" min={0} value={amountPaidGuest} onChange={(e) => setAmountPaidGuest(e.target.value)} className={inputCls} />
              </Field>
            </div>

            <Field label="Customer Decision">
              <select value={customerDecision} onChange={(e) => setCustomerDecision(e.target.value)} className={inputCls}>
                <option value="">— Select —</option>
                {DECISION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {customerDecision === 'Other' && (
                <input
                  value={customerDecisionOther} onChange={(e) => setCustomerDecisionOther(e.target.value)}
                  className={`${inputCls} mt-2`} placeholder="Describe…"
                />
              )}
            </Field>

            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={refundDeposit} onChange={(e) => setRefundDeposit(e.target.checked)} className="w-4 h-4 accent-brand-500" />
              Refund deposit
            </label>

            <button
              type="button"
              disabled={returnSubmitting}
              onClick={handleCompleteReturn}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition"
            >
              {returnSubmitting ? 'Completing return…' : 'Complete Return'}
            </button>
          </Section>
        )}

        {showReadOnlySummary && (
          <Section title="Trip Summary" subtitle={trip.status === 'CANCELLED' ? 'This trip was cancelled.' : 'Completed trip record.'}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Odometer</p>
                <p className="font-semibold">{trip.odometerStart ?? '—'} → {trip.odometerEnd ?? '—'} km</p>
                {trip.rangeKm != null && <p className="text-xs text-slate-500">{trip.rangeKm} km travelled</p>}
              </div>
              <div>
                <p className="text-xs text-slate-500">Fuel / Tyres</p>
                <p className="font-semibold">{trip.tyreHealth ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Base Fare</p>
                <p className="font-semibold">{inr(trip.baseFare)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Amount</p>
                <p className="font-semibold">{inr(trip.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Amount Collected</p>
                <p className="font-semibold">{inr(trip.amountCollected)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Amount Paid to Guest</p>
                <p className="font-semibold">{inr(trip.amountPaidGuest)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Deposit</p>
                <p className="font-semibold">{inr(trip.depositCollected ?? trip.depositAmount)} · {trip.depositPaymentMode ?? '—'}</p>
                {trip.depositRefundedAt && <p className="text-xs text-emerald-400">Refunded {new Date(trip.depositRefundedAt).toLocaleDateString()}</p>}
              </div>
              <div>
                <p className="text-xs text-slate-500">Car Washed</p>
                <p className="font-semibold">{trip.carWashed ? `Yes · ${inr(trip.washingCharges)}` : 'No'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500">Customer Decision</p>
                <p className="font-semibold">{trip.customerDecision ?? '—'}</p>
              </div>
              {trip.newDamages && (
                <div className="col-span-2">
                  <p className="text-xs text-slate-500">New Damages</p>
                  <p className="font-semibold">{trip.newDamages}</p>
                </div>
              )}
            </div>

            {trip.checkoutAddons && trip.checkoutAddons.length > 0 && (
              <div className="pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-500 mb-2">Checkout Add-ons</p>
                <div className="space-y-1.5">
                  {trip.checkoutAddons.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{a.type}{a.note ? ` — ${a.note}` : ''}</span>
                      <span className="font-semibold">{inr(a.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {trip.vehiclePhotoUrls && trip.vehiclePhotoUrls.length > 0 && (
              <div className="pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-500 mb-2">Vehicle Condition Photos</p>
                <div className="flex flex-wrap gap-3">
                  {trip.vehiclePhotoUrls.map((url) => <Thumb key={url} url={url} />)}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 text-xs text-slate-500">
              <p>ID Verification: {trip.idVerificationMethod ?? '—'}</p>
              <p>Signature on file: {trip.customerSignatureUrl ? 'Yes' : 'No'}</p>
            </div>
          </Section>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

export default function TripDetailPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<LoadingScreen label="Loading trip…" />}>
        <TripDetailInner />
      </Suspense>
    </ProtectedRoute>
  );
}
