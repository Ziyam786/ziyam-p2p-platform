'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import Footer from '../../../../components/Footer';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import { bookingsApi } from '../../../../lib/api';
import type { Booking } from '../../../../lib/types';

function ConfirmationInner() {
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    bookingsApi.get(params.id).then((res) => setBooking(res.data));
  }, [params.id]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 pt-32 pb-24 text-center">
        <span className="text-6xl block mb-4">🎉</span>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Booking Confirmed!</h1>
        <p className="text-gray-500 text-sm mb-8">
          Your trip is booked. Pickup details and the host's contact info are in your trip page.
        </p>

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
          <a href={`/account/trips/${params.id}`} className="btn-gradient text-white font-bold px-6 py-3 rounded-xl transition text-sm">
            View Trip Details
          </a>
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
