'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { bookingsApi } from '../../../lib/api';
import type { Booking, BookingStatus } from '../../../lib/types';

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PENDING_PAYMENT: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-gray-800 text-white',
  CANCELLED: 'bg-red-100 text-red-600',
};

function TripsInner() {
  const [trips, setTrips] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    bookingsApi
      .myTrips()
      .then((res) => setTrips(res.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = trips.filter((t) => {
    if (filter === 'upcoming') return ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE'].includes(t.status);
    if (filter === 'past') return ['COMPLETED', 'CANCELLED'].includes(t.status);
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 pt-28 pb-20">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">My Trips</h1>
        <p className="text-gray-500 text-sm mb-6">Your booking history and upcoming reservations</p>

        <div className="flex gap-2 mb-6">
          {(['all', 'upcoming', 'past'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                filter === f ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading trips…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <span className="text-4xl block mb-3">🧳</span>
            <p className="text-gray-500 mb-4">No trips here yet.</p>
            <a href="/cars" className="text-amber-500 font-semibold underline">Browse cars</a>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((trip) => (
              <a
                key={trip.id}
                href={`/account/trips/${trip.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-5 hover:border-amber-300 transition"
              >
                <div className="flex flex-wrap items-center gap-4 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      <Image src={trip.car?.images?.[0] ?? '/placeholder-car.jpg'} alt="" fill sizes="80px" className="object-cover" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{trip.car?.make} {trip.car?.model}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(trip.startTime).toLocaleDateString()} → {new Date(trip.endTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-gray-900">₹{trip.totalAmount.toLocaleString()}</span>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_STYLES[trip.status]}`}>
                      {trip.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default function TripsPage() {
  return (
    <ProtectedRoute>
      <TripsInner />
    </ProtectedRoute>
  );
}
