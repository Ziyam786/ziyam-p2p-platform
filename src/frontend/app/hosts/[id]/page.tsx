'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import CarCard from '../../../components/CarCard';
import Rating from '../../../components/Rating';
import { publicHostApi } from '../../../lib/api';
import type { Car, PublicUser, Review } from '../../../lib/types';

export default function HostProfilePage() {
  const params = useParams<{ id: string }>();
  const [host, setHost] = useState<PublicUser | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([publicHostApi.profile(params.id), publicHostApi.cars(params.id), publicHostApi.reviews(params.id)])
      .then(([p, c, r]) => {
        setHost(p.data);
        setCars(c.data);
        setReviews(r.data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  const avgRating = reviews.length === 0 ? 0 : Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1));

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400">Loading host profile…</div>;
  if (notFound || !host) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans">
        <Navbar />
        <div className="max-w-md mx-auto px-4 pt-40 text-center">
          <p className="text-gray-500 mb-4">Host not found.</p>
          <a href="/cars" className="text-amber-500 underline font-semibold">Browse cars</a>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 pt-28 pb-24">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-10">
          <div className="relative w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center text-4xl overflow-hidden shrink-0">
            {host.avatarUrl ? <Image src={host.avatarUrl} alt="" fill sizes="96px" className="object-cover" /> : '👤'}
          </div>
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
              <h1 className="text-2xl font-extrabold text-gray-900">{host.fullName}</h1>
              {host.isKycVerified && (
                <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">✓ Verified</span>
              )}
              <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {host.role === 'FLEET_OPERATOR' ? 'Fleet Operator' : 'Self Host'}
              </span>
            </div>
            <div className="mt-2 flex justify-center sm:justify-start">
              <Rating value={avgRating} count={reviews.length} size="md" />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Hosting since {new Date(host.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
            {host.bio && <p className="text-sm text-gray-600 mt-3 max-w-lg">{host.bio}</p>}
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-4">Cars by {host.fullName.split(' ')[0]} ({cars.length})</h2>
        {cars.length === 0 ? (
          <p className="text-gray-400 text-sm mb-10">No active listings right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {cars.map((car) => <CarCard key={car.id} car={car} />)}
          </div>
        )}

        <h2 className="text-xl font-bold text-gray-900 mb-4">Reviews ({reviews.length})</h2>
        {reviews.length === 0 ? (
          <p className="text-gray-400 text-sm">No reviews yet.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-gray-50 last:border-0 pb-4 last:pb-0">
                <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
                  <span className="font-semibold text-gray-800 text-sm">{r.author?.fullName ?? 'Renter'}</span>
                  <Rating value={r.rating} />
                </div>
                {r.car && <p className="text-xs text-gray-400">{r.car.make} {r.car.model}</p>}
                {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
