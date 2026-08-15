'use client';

import React, { useEffect, useState } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import ProtectedRoute from '../../../components/ProtectedRoute';
import CarCard from '../../../components/CarCard';
import { CarCardSkeleton } from '../../../components/Skeleton';
import { wishlistApi } from '../../../lib/api';
import type { Car } from '../../../lib/types';

function WishlistInner() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wishlistApi.list().then((res) => setCars(res.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 pt-28 pb-20">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">My Wishlist</h1>
        <p className="text-gray-500 text-sm mb-8">Cars you've saved for later</p>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => <CarCardSkeleton key={i} />)}
          </div>
        ) : cars.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <span className="text-4xl block mb-3">♡</span>
            <p className="text-gray-500 mb-4">No saved cars yet. Tap the heart icon on any listing to save it here.</p>
            <a href="/cars" className="text-amber-500 font-semibold underline">Browse cars</a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cars.map((car) => <CarCard key={car.id} car={car} />)}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

export default function WishlistPage() {
  return (
    <ProtectedRoute>
      <WishlistInner />
    </ProtectedRoute>
  );
}
