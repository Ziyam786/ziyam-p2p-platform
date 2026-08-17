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
import { bookingsApi, reviewsApi } from '../../../../lib/api';
import type { Booking } from '../../../../lib/types';

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

  const isHost = Boolean(user && trip?.car && trip.car.ownerId === user.id);

  function load() {
    bookingsApi
      .get(params.id)
      .then((res) => setTrip(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [params.id]);

  useEffect(() => {
    if (trip?.status === 'ACTIVE' && isHost) {
      bookingsApi.endOtp(trip.id).then((res) => setEndOtp(res.data.otp)).catch(() => {});
    }
  }, [trip?.status, isHost, trip?.id]);

  async function handleAction(action: 'start' | 'unlock' | 'cancel') {
    if (!trip) return;
    setBusy(true);
    try {
      if (action === 'start') await bookingsApi.start(trip.id);
      if (action === 'unlock') await bookingsApi.unlock(trip.id);
      if (action === 'cancel') await bookingsApi.cancel(trip.id);
      show(action === 'unlock' ? 'Vehicle unlocked' : 'Trip updated', 'success');
      load();
    } catch (err: any) {
      show(err.message ?? 'Action failed', 'error');
    } finally {
      setBusy(false);
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
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">{trip.status.replace('_', ' ')}</span>
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
              {trip.status === 'CONFIRMED' && (
                <button disabled={busy} onClick={() => handleAction('start')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50">
                  Start Trip (Pickup)
                </button>
              )}
              {trip.status === 'ACTIVE' && !isHost && (
                <button disabled={busy} onClick={() => handleAction('unlock')} className="bg-gray-900 hover:bg-black text-white text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50">
                  🔓 Keyless Unlock
                </button>
              )}
              {['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'].includes(trip.status) && (
                <button disabled={busy} onClick={() => handleAction('cancel')} className="border border-red-300 text-red-500 hover:bg-red-50 text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-50">
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
            )}
          </div>
        </div>

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
