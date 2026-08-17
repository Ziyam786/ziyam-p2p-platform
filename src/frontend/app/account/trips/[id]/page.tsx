'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import Footer from '../../../../components/Footer';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import Rating from '../../../../components/Rating';
import { useToast } from '../../../../components/Toast';
import { useAuth } from '../../../../lib/auth-context';
import TripChat from '../../../../components/TripChat';
import ConditionPhotoCapture from '../../../../components/ConditionPhotoCapture';
import { HostDeliverySharePanel, GuestDeliveryTracker } from '../../../../components/LiveDeliveryTracker';
import { bookingsApi, reviewsApi } from '../../../../lib/api';
import type { Booking, BookingConditionPhoto, PhotoAngle, TripStage } from '../../../../lib/types';

const REQUIRED_PHOTO_ANGLES: PhotoAngle[] = ['FRONT', 'REAR', 'LEFT', 'RIGHT'];

function computeCancelPreview(trip: Booking) {
  const hoursUntilStart = (new Date(trip.startTime).getTime() - Date.now()) / (60 * 60 * 1000);
  const tripCost = trip.totalAmount - trip.platformFee;
  let retentionPercent: number;
  let tierLabel: string;
  if (hoursUntilStart > 24) {
    retentionPercent = 0;
    tierLabel = "It's more than 24h before your trip — no cancellation charge applies.";
  } else if (hoursUntilStart >= 6) {
    retentionPercent = 0.25;
    tierLabel = "It's 6–24h before your trip — a 25% cancellation charge applies to the trip cost.";
  } else {
    retentionPercent = 0.5;
    tierLabel = "It's within 6h of your trip — a 50% cancellation charge applies to the trip cost.";
  }
  const retained = Math.round(tripCost * retentionPercent);
  const refundAmount = tripCost - retained + trip.depositAmount;
  return { retentionPercent, tierLabel, refundAmount };
}

function TripDetailInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { show } = useToast();
  const { user } = useAuth();

  const [trip, setTrip] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [endOtp, setEndOtp] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [washRequested, setWashRequested] = useState(false);
  const [conditionPhotos, setConditionPhotos] = useState<BookingConditionPhoto[]>([]);
  const [capturingStage, setCapturingStage] = useState<TripStage | null>(null);
  const [cancelPreviewOpen, setCancelPreviewOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  const isHost = Boolean(user && trip?.car && trip.car.ownerId === user.id);

  function hasRequiredPhotos(stage: TripStage) {
    const angles = new Set(conditionPhotos.filter((p) => p.stage === stage).map((p) => p.angle));
    return REQUIRED_PHOTO_ANGLES.every((a) => angles.has(a));
  }

  function loadConditionPhotos(bookingId: string) {
    bookingsApi.conditionPhotos(bookingId).then((res) => setConditionPhotos(res.data)).catch(() => {});
  }

  function load() {
    bookingsApi
      .get(params.id)
      .then((res) => setTrip(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [params.id]);
  useEffect(() => { loadConditionPhotos(params.id); }, [params.id]);

  useEffect(() => {
    if (trip?.status === 'ACTIVE' && isHost) {
      bookingsApi.endOtp(trip.id).then((res) => setEndOtp(res.data.otp)).catch(() => {});
    }
  }, [trip?.status, isHost, trip?.id]);

  async function handleAction(action: 'start' | 'unlock') {
    if (!trip) return;
    setBusy(true);
    try {
      if (action === 'start') await bookingsApi.start(trip.id);
      if (action === 'unlock') await bookingsApi.unlock(trip.id);
      show(action === 'unlock' ? 'Vehicle unlocked' : 'Trip updated', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    if (!trip) return;
    setCancelBusy(true);
    try {
      const res = await bookingsApi.cancel(trip.id, { reason: cancelReason.trim() || undefined });
      show(`Booking cancelled — ₹${res.refundAmount.toLocaleString('en-IN')} will be refunded`, 'success');
      setCancelPreviewOpen(false);
      setCancelReason('');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to cancel booking', 'error');
    } finally {
      setCancelBusy(false);
    }
  }

  async function handleCompleteTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;
    setBusy(true);
    try {
      await bookingsApi.complete(trip.id, otpInput);
      show('Trip completed!', 'success');
      setOtpInput('');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to complete trip', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function requestWash() {
    if (!trip) return;
    setBusy(true);
    try {
      const res = await bookingsApi.requestWash(trip.id);
      show(res.message, 'success');
      setWashRequested(true);
    } catch (err: any) {
      show(err.message ?? 'Failed to request wash service', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;
    setBusy(true);
    try {
      await reviewsApi.create({ bookingId: trip.id, rating, comment });
      show('Thanks for your review!', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Failed to submit review', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading trip…</div>;
  }
  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 pt-40 text-center">
          <p className="text-gray-500 mb-4">Trip not found.</p>
          <a href="/account/trips" className="text-amber-500 underline font-semibold">Back to trips</a>
        </div>
        <Footer />
      </div>
    );
  }

  const days = Math.max(1, Math.round((new Date(trip.endTime).getTime() - new Date(trip.startTime).getTime()) / (1000 * 60 * 60 * 24)));
  const statusLabel = trip.status === 'PENDING_HOST_REVIEW' ? 'Awaiting host confirmation' : trip.status === 'REJECTED' ? 'Declined by host' : trip.status.replace(/_/g, ' ');
  const statusColor = trip.status === 'REJECTED' || trip.status === 'CANCELLED'
    ? 'bg-red-100 text-red-600'
    : trip.status === 'PENDING_HOST_REVIEW' || trip.status === 'PENDING_PAYMENT'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-700';
  const cancelPreview = computeCancelPreview(trip);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-20">
        <button onClick={() => router.push('/account/trips')} className="text-xs text-gray-400 hover:text-amber-500 mb-4">
          ← Back to trips
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
          <div className="relative w-full h-56">
            <Image src={trip.car?.images?.[0] ?? '/placeholder-car.jpg'} alt="" fill sizes="(max-width: 768px) 100vw, 700px" className="object-cover" />
          </div>
          <div className="p-6">
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">{trip.car?.make} {trip.car?.model}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(trip.startTime).toLocaleString()} → {new Date(trip.endTime).toLocaleString()} ({days} day{days > 1 ? 's' : ''})
                </p>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${statusColor}`}>{statusLabel}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
              <Stat label="Protection Plan" value={trip.protectionPlan} />
              <Stat label="Platform Fee" value={`₹${trip.platformFee.toLocaleString()}`} />
              {trip.depositAmount > 0 && (
                <Stat
                  label={`Deposit (${trip.depositStatus.replace(/_/g, ' ').toLowerCase()})`}
                  value={`₹${trip.depositAmount.toLocaleString()}`}
                />
              )}
              <Stat label="Total Paid" value={`₹${(trip.totalAmount + trip.depositAmount).toLocaleString()}`} />
            </div>

            <div className="flex flex-wrap gap-3 mt-6">
              {trip.status === 'PENDING_PAYMENT' && (
                <a href={`/checkout/${trip.id}`} className="btn-gradient text-white text-sm font-bold px-5 py-2.5 rounded-xl transition">
                  Complete Payment
                </a>
              )}
              {trip.status === 'CONFIRMED' && capturingStage !== 'PRE_TRIP' && (
                <button
                  disabled={busy}
                  onClick={() => (hasRequiredPhotos('PRE_TRIP') ? handleAction('start') : setCapturingStage('PRE_TRIP'))}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
                >
                  {hasRequiredPhotos('PRE_TRIP') ? 'Start Trip (Pickup)' : '📷 Add Pickup Photos to Start'}
                </button>
              )}
              {trip.status === 'ACTIVE' && !isHost && (
                <button disabled={busy} onClick={() => handleAction('unlock')} className="bg-gray-900 hover:bg-black text-white text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50">
                  🔓 Keyless Unlock
                </button>
              )}
              {['PENDING_HOST_REVIEW', 'CONFIRMED'].includes(trip.status) && !cancelPreviewOpen && (
                <button disabled={busy} onClick={() => setCancelPreviewOpen(true)} className="border border-red-300 text-red-500 hover:bg-red-50 text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50">
                  Cancel Booking
                </button>
              )}
              {['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(trip.status) && (
                <a href={`/bookings/${trip.id}/agreement`} className="border border-gray-200 text-gray-700 hover:border-amber-400 text-sm font-bold px-5 py-2.5 rounded-xl transition">
                  📄 View Lease Agreement
                </a>
              )}
              {['ACTIVE', 'COMPLETED'].includes(trip.status) && !isHost && (
                <button
                  disabled={busy || washRequested}
                  onClick={requestWash}
                  className="border border-gray-200 text-gray-700 hover:border-amber-400 text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50"
                >
                  🧼 {washRequested ? 'Wash Requested' : `Request Wash (₹349)`}
                </button>
              )}
            </div>

            {trip.status === 'CONFIRMED' && capturingStage === 'PRE_TRIP' && (
              <div className="mt-6">
                <ConditionPhotoCapture
                  bookingId={trip.id}
                  stage="PRE_TRIP"
                  onCancel={() => setCapturingStage(null)}
                  onComplete={() => {
                    setCapturingStage(null);
                    loadConditionPhotos(trip.id);
                    handleAction('start');
                  }}
                />
              </div>
            )}

            {cancelPreviewOpen && (
              <div className="mt-6 bg-red-50 border border-red-100 rounded-xl p-5">
                <p className="font-bold text-gray-900 mb-1">Cancel this booking?</p>
                <p className="text-sm text-gray-600 mb-3">{cancelPreview.tierLabel}</p>
                <p className="text-sm text-gray-800 mb-4">
                  You'll be refunded <span className="font-bold">₹{cancelPreview.refundAmount.toLocaleString('en-IN')}</span> of
                  ₹{(trip.totalAmount + trip.depositAmount).toLocaleString('en-IN')} paid (the platform fee is never refunded; your
                  full security deposit always is).
                </p>
                <input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setCancelPreviewOpen(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-2">
                    Keep Booking
                  </button>
                  <button disabled={cancelBusy} onClick={confirmCancel} className="text-sm font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl transition">
                    {cancelBusy ? 'Cancelling…' : 'Confirm Cancellation'}
                  </button>
                </div>
              </div>
            )}

            {trip.status === 'PENDING_HOST_REVIEW' && (
              <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-5 text-center">
                <p className="text-sm font-bold text-amber-800">Waiting for the host to confirm this booking</p>
                <p className="text-xs text-gray-500 mt-1">
                  The host is checking the car is available for your dates.
                  {trip.hostReviewDeadline && ` They'll respond by ${new Date(trip.hostReviewDeadline).toLocaleString()}.`}
                  {' '}You'll be notified either way — a non-response is treated the same as a decline and fully refunded.
                </p>
              </div>
            )}

            {trip.status === 'REJECTED' && (
              <div className="mt-6 bg-red-50 border border-red-100 rounded-xl p-5">
                <p className="text-sm font-bold text-red-700">Declined by the host</p>
                <p className="text-xs text-gray-600 mt-1">
                  {trip.rejectionReason ? trip.rejectionReason.replace(/_/g, ' ').toLowerCase() : 'The host was unable to confirm this booking.'}
                  {' '}You've been refunded in full — the trip cost and your entire security deposit, with no cancellation charge
                  (only the non-refundable platform fee is retained, same as any booking).
                </p>
              </div>
            )}

            {trip.status === 'CONFIRMED' && trip.deliveryRequested && isHost && <HostDeliverySharePanel bookingId={trip.id} />}

            {trip.status === 'ACTIVE' && isHost && (
              <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-5 text-center">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Trip-End Handover Code</p>
                {endOtp ? (
                  <div className="flex justify-center gap-2">
                    {endOtp.split('').map((digit, i) => (
                      <span key={i} className="w-10 h-12 flex items-center justify-center bg-white border border-amber-200 rounded-lg text-xl font-extrabold text-amber-700">{digit}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Loading…</p>
                )}
                <p className="text-xs text-gray-500 mt-3">Share this code with the guest only once they've physically returned the car — they'll enter it in their app to close out the trip.</p>
              </div>
            )}

            {trip.status === 'ACTIVE' && !isHost && (
              hasRequiredPhotos('POST_TRIP') ? (
                <form onSubmit={handleCompleteTrip} className="mt-6 bg-gray-50 border border-gray-100 rounded-xl p-5">
                  <p className="text-sm font-bold text-gray-800 mb-1">Returning the car?</p>
                  <p className="text-xs text-gray-500 mb-3">Ask the host for the 4-digit code shown in their app to complete this trip.</p>
                  <div className="flex gap-3">
                    <input
                      required
                      inputMode="numeric"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="4-digit code"
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-center tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button disabled={busy || otpInput.length !== 4} type="submit" className="btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold px-6 rounded-xl transition text-sm">
                      Complete Trip
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-6">
                  <ConditionPhotoCapture bookingId={trip.id} stage="POST_TRIP" onComplete={() => loadConditionPhotos(trip.id)} />
                </div>
              )
            )}
          </div>
        </div>

        {trip.status === 'CONFIRMED' && trip.deliveryRequested && !isHost && <GuestDeliveryTracker bookingId={trip.id} />}

        {['ACTIVE', 'COMPLETED'].includes(trip.status) && conditionPhotos.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <h2 className="font-bold text-gray-900 mb-4">Vehicle Condition Photos</h2>
            {(['PRE_TRIP', 'POST_TRIP'] as const).map((stage) => {
              const stagePhotos = conditionPhotos.filter((p) => p.stage === stage);
              if (stagePhotos.length === 0) return null;
              return (
                <div key={stage} className="mb-4 last:mb-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{stage === 'PRE_TRIP' ? 'Pickup' : 'Drop-off'}</p>
                  <div className="flex flex-wrap gap-2">
                    {stagePhotos.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.id} src={p.url} alt={p.angle} title={p.angle.replace(/_/g, ' ')} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {['CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(trip.status) && (
          <div className="mb-6">
            <TripChat bookingId={trip.id} otherPartyName={isHost ? trip.customer?.fullName : trip.car?.owner?.fullName} />
          </div>
        )}

        {trip.status === 'COMPLETED' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-4">Rate your trip</h2>
            {trip.review ? (
              <div>
                <Rating value={trip.review.rating} size="md" />
                {trip.review.comment && <p className="text-sm text-gray-600 mt-2">{trip.review.comment}</p>}
              </div>
            ) : (
              <form onSubmit={submitReview} className="space-y-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n)} className="text-2xl">
                      {n <= rating ? '★' : '☆'}
                    </button>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="How was the car and host?"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button disabled={busy} type="submit" className="btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold px-6 py-2.5 rounded-xl transition text-sm">
                  Submit Review
                </button>
              </form>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="font-bold text-gray-900 text-sm mt-1">{value}</p>
    </div>
  );
}

export default function TripDetailPage() {
  return (
    <ProtectedRoute>
      <TripDetailInner />
    </ProtectedRoute>
  );
}
