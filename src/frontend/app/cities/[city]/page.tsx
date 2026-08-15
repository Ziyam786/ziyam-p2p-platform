'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import CarCard from '../../../components/CarCard';
import { CarCardSkeleton } from '../../../components/Skeleton';
import { carsApi } from '../../../lib/api';
import type { Car } from '../../../lib/types';

export default function CityPage() {
  const params = useParams<{ city: string }>();
  const city = decodeURIComponent(params.city);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carsApi.list({ city, availableOnly: true }).then((res) => setCars(res.data)).finally(() => setLoading(false));
  }, [city]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <section className="bg-gray-950 text-white pt-32 pb-14 text-center px-4">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4 block">Self-Drive Rentals</span>
        <h1 className="text-3xl md:text-5xl font-extrabold mb-3">Rent a car in {city}</h1>
        <p className="text-gray-400 max-w-xl mx-auto">
          {loading ? 'Loading availability…' : `${cars.length} verified cars available right now in ${city}.`}
        </p>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <CarCardSkeleton key={i} />)}
            </div>
          ) : cars.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-4xl block mb-3">🚗</span>
              <p className="text-gray-500 mb-4">No cars listed in {city} yet.</p>
              <a href="/cars" className="text-amber-500 underline font-semibold">Browse all cities</a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cars.map((car) => <CarCard key={car.id} car={car} />)}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
