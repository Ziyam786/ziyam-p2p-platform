'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PlanDestinationInput, { type ResolvedDestination } from '../../components/PlanDestinationInput';
import PlanCarSuggestion from '../../components/PlanCarSuggestion';
import PlanPriceEstimate from '../../components/PlanPriceEstimate';
import PlanHotelSuggestions from '../../components/PlanHotelSuggestions';
import ItineraryUnlockModal from '../../components/ItineraryUnlockModal';
import { setStickyDates } from '../../lib/searchDates';
import type { PlanCar } from '../../lib/api';

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PlanPage() {
  const router = useRouter();
  const [destination, setDestination] = useState<ResolvedDestination | null>(null);
  const [suggestedCar, setSuggestedCar] = useState<PlanCar | null>(null);
  const [hotelPriceLevel, setHotelPriceLevel] = useState<number | null>(null);
  const [days, setDays] = useState(2);
  const [unlockDestination, setUnlockDestination] = useState<string | null>(null);

  function handleBookNow() {
    if (!suggestedCar) return;
    const pickup = new Date();
    pickup.setDate(pickup.getDate() + 1);
    pickup.setHours(10, 0, 0, 0);
    const dropoff = new Date(pickup);
    dropoff.setDate(dropoff.getDate() + days);
    setStickyDates(toLocalInput(pickup), toLocalInput(dropoff));
    router.push(`/cars/${suggestedCar.id}`);
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Plan your road trip</h1>
        <p className="text-gray-500 text-sm mb-8">Tell us where you're headed — we'll suggest a car, a price estimate, and places to stay.</p>

        <PlanDestinationInput onResolved={setDestination} />

        {destination && (
          <div className="mt-8 space-y-6">
            <p className="text-sm text-gray-500">
              Bengaluru → {destination.placeName} · ~{destination.distanceKm}km
            </p>

            <PlanCarSuggestion distanceKm={destination.distanceKm} onResolved={setSuggestedCar} />

            {suggestedCar && (
              <PlanPriceEstimate
                dailyRate={suggestedCar.dailyRate}
                distanceKm={destination.distanceKm}
                hotelPriceLevel={hotelPriceLevel}
                onDaysChange={setDays}
              />
            )}

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Places to stay nearby</p>
              <PlanHotelSuggestions lat={destination.lat} lng={destination.lng} onResolved={setHotelPriceLevel} />
            </div>

            {suggestedCar && (
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleBookNow}
                  className="flex-1 btn-gradient text-white font-bold py-3 rounded-xl transition text-center"
                >
                  Book this car
                </button>
                <button
                  onClick={() => setUnlockDestination(destination.placeName)}
                  className="flex-1 border border-amber-500 text-amber-500 hover:bg-amber-50 font-bold py-3 rounded-xl transition text-center"
                >
                  Get the ₹49 day-by-day PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <ItineraryUnlockModal destination={unlockDestination} onClose={() => setUnlockDestination(null)} />
      <Footer />
    </div>
  );
}
