'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import Footer from '../../../../components/Footer';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { bookingsApi } from '../../../../lib/api';
import { trackEvent } from '../../../../lib/mixpanel';
import type { Booking } from '../../../../lib/types';

const PAID_BOOKING_STATUSES = new Set(['RESERVED', 'PENDING_HOST_REVIEW', 'CONFIRMED']);

function ConfirmationInner() {
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    bookingsApi.get(params.id).then((res) => {
      const next = res.data;
      setBooking(next);
      if (!PAID_BOOKING_STATUSES.has(next.status)) return;
      const dedupeKey = `mp_booking_completed_${next.id}`;
      try {
        if (sessionStorage.getItem(dedupeKey)) return;
        sessionStorage.setItem(dedupeKey, '1');
      } catch {
        // sessionStorage can be unavailable; still track once this mount.
      }
      const properties: Record<string, string | number | boolean> = {
        booking_id: next.id,
        booking_status: next.status,
        car_id: next.carId,
        total_amount: next.totalAmount,
        protection_plan: next.protectionPlan,
        is_delivery_requested: next.deliveryRequested,
      };
      if (next.car?.city) properties.city = next.car.city;
      trackEvent('booking_completed', properties);
    });
  }, [params.id]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-32 pb-24 text-center">
        {booking?.status === 'RESERVED' ? (
          <>
            <span className="text-6xl block mb-4">📌</span>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Dates Reserved!</h1>
            <p className="text-gray-500 text-sm mb-8">
              ₹{booking.reservationFeeAmount.toLocaleString()} reservation fee received — these dates are held for you.
              {booking.reservationDeadline && ` Pay the balance by ${new Date(booking.reservationDeadline).toLocaleString()} to lock in your trip.`}
            </p>
          </>
        ) : booking?.status === 'PENDING_HOST_REVIEW' ? (
          <>
            <span className="text-6xl block mb-4">🕒</span>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Request Sent!</h1>
            <p className="text-gray-500 text-sm mb-8">
              Payment received. The host is confirming the car is available for your dates — you'll be notified as soon as
              they accept (or, if they can't, you're fully refunded automatically).
            </p>
          </>
        ) : (
          <>
            <span className="text-6xl block mb-4">🎉</span>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Booking Confirmed!</h1>
            <p className="text-gray-500 text-sm mb-8">
              Your trip is booked. Pickup details and the host's contact info are in your trip page.
            </p>
          </>
        )}

        {booking && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-left mb-8">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                <Image src={booking.car?.images?.[0] ?? '/placeholder-car.jpg'} alt="" fill sizes="80px" className="object-cover" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{booking.car?.make} {booking.car?.model}</p>
                <p className="text-xs text-gray-500">
                  {new Date(booking.startTime).toLocaleDateString()} → {new Date(booking.endTime).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {booking?.status === 'RESERVED' ? (
            <a href={`/checkout/${params.id}`} className="btn-gradient text-white font-bold px-6 py-3 rounded-xl transition text-sm">
              Pay Balance Now
            </a>
          ) : (
            <a href={`/account/trips/${params.id}`} className="btn-gradient text-white font-bold px-6 py-3 rounded-xl transition text-sm">
              View Trip Details
            </a>
          )}
          <a href="/cars" className="border border-gray-200 text-gray-700 hover:border-amber-400 font-bold px-6 py-3 rounded-xl transition text-sm">
            Browse More Cars
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <ProtectedRoute>
      <ConfirmationInner />
    </ProtectedRoute>
  );
}
