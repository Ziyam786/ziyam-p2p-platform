'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useToast } from '../../../components/Toast';
import { bookingsApi } from '../../../lib/api';
import type { Booking } from '../../../lib/types';

function CheckoutInner() {
  const params = useParams<{ bookingId: string }>();
  const searchParams = useSearchParams();
  const { show } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState<{ url: string; fields: Record<string, string> } | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    bookingsApi
      .get(params.bookingId)
      .then((res) => setBooking(res.data))
      .catch((err) => show(err.message ?? 'Booking not found', 'error'))
      .finally(() => setLoading(false));
  }, [params.bookingId, show]);

  useEffect(() => {
    const paymentIssue = searchParams.get('payment');
    if (paymentIssue === 'failed') show('Payment did not go through. Please try again.', 'error');
    if (paymentIssue === 'unverified') show('We could not verify that payment. Please try again or contact support.', 'error');
  }, [searchParams, show]);

  async function handlePay() {
    if (!booking) return;
    setPaying(true);
    try {
      const res = await bookingsApi.createCheckoutSession(booking.id);
      setCheckout(res.data);
      // Wait a tick for the hidden form's inputs to render with the new fields, then submit.
      requestAnimationFrame(() => formRef.current?.submit());
    } catch (err: any) {
      show(err.message ?? 'Could not start payment', 'error');
      setPaying(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading checkout…</div>;
  if (!booking) return null;

  if (booking.status !== 'PENDING_PAYMENT') {
    return (
      <div className="min-h-screen bg-gray-50 font-sans">
        <Navbar />
        <div className="max-w-md mx-auto px-4 pt-40 text-center">
          <p className="text-gray-500 mb-4">This booking has already been processed.</p>
          <a href={`/account/trips/${booking.id}`} className="text-amber-500 underline font-semibold">View trip</a>
        </div>
        <Footer />
      </div>
    );
  }

  const days = Math.max(1, Math.round((new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / (1000 * 60 * 60 * 24)));
  // Charged in the same PayU transaction as the trip cost — see
  // booking.routes.ts's /checkout-session (amount: totalAmount + depositAmount).
  const amountToPay = booking.totalAmount + booking.depositAmount;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-28 pb-24">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Checkout</h1>
        <p className="text-gray-500 text-sm mb-8">Review your trip and complete payment</p>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
              <Image src={booking.car?.images?.[0] ?? '/placeholder-car.jpg'} alt="" fill sizes="80px" className="object-cover" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{booking.car?.make} {booking.car?.model}</p>
              <p className="text-xs text-gray-500">{days} day{days > 1 ? 's' : ''} · {booking.protectionPlan} protection</p>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-700">
              <span>Pickup</span>
              <span>{new Date(booking.startTime).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Drop-off</span>
              <span>{new Date(booking.endTime).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Platform fee</span>
              <span>₹{booking.platformFee.toLocaleString()}</span>
            </div>
            {booking.depositAmount > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Security deposit (refundable)</span>
                <span>₹{booking.depositAmount.toLocaleString()}</span>
              </div>
            )}
            <hr className="border-gray-100" />
            <div className="flex justify-between font-bold text-gray-900 text-base">
              <span>Total to pay</span>
              <span className="text-amber-600">₹{amountToPay.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
            🔒 You'll be redirected to PayU's secure checkout to complete payment.
          </div>

          {/* Hidden auto-submitting form to PayU's hosted checkout — filled in once a session is started. */}
          <form ref={formRef} action={checkout?.url} method="POST" className="hidden">
            {checkout && Object.entries(checkout.fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
          </form>

          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full btn-gradient active:scale-[0.98] disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none disabled:active:scale-100 text-white font-bold py-3.5 rounded-xl transition-transform"
          >
            {paying ? 'Redirecting to PayU…' : `Pay ₹${amountToPay.toLocaleString()}`}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <CheckoutInner />
      </Suspense>
    </ProtectedRoute>
  );
}
