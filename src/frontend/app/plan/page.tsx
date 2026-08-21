'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Route } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PlanDestinationInput, { type ResolvedDestination } from '../../components/PlanDestinationInput';
import PlanCarSuggestion from '../../components/PlanCarSuggestion';
import PlanPriceEstimate from '../../components/PlanPriceEstimate';
import PlanHotelSuggestions from '../../components/PlanHotelSuggestions';
import PlanRouteMap from '../../components/PlanRouteMap';
import PlanStepper from '../../components/PlanStepper';
import ItineraryUnlockModal from '../../components/ItineraryUnlockModal';
import { setStickyDates } from '../../lib/searchDates';
import type { PlanCar } from '../../lib/api';

const STEPS = ['Destination', 'Your car', 'Price', 'Places to stay', 'Book'];

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

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

  // Reset the stale car/hotel suggestions whenever the resolved destination
  // changes (including becoming null while the user edits the input). Without
  // this, a suggestion from the previous destination can briefly linger while
  // the newly-mounted child components fetch fresh data for the new one.
  useEffect(() => {
    setSuggestedCar(null);
    setHotelPriceLevel(null);
  }, [destination?.placeName]);

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

  const stepIndex = suggestedCar ? 4 : destination ? 1 : 0;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="bg-gray-900 pt-28 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Route className="w-4 h-4" />
            Road trip planner
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Plan your road trip</h1>
          <p className="text-gray-400 text-sm mb-8">Tell us where you're headed — we'll suggest a car, a price estimate, and places to stay.</p>

          <PlanDestinationInput onResolved={setDestination} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <PlanStepper steps={STEPS} activeIndex={stepIndex} />

        {destination && (
          <motion.div key={destination.placeName} initial="initial" animate="animate" className="space-y-6">
            <motion.p {...fadeUp} className="text-sm text-gray-500">
              Bengaluru → {destination.placeName} · ~{destination.distanceKm}km
            </motion.p>

            <motion.div {...fadeUp}>
              <PlanRouteMap destination={destination} />
            </motion.div>

            <motion.div {...fadeUp}>
              <PlanCarSuggestion distanceKm={destination.distanceKm} onResolved={setSuggestedCar} />
            </motion.div>

            {suggestedCar && (
              <motion.div {...fadeUp}>
                <PlanPriceEstimate
                  dailyRate={suggestedCar.dailyRate}
                  distanceKm={destination.distanceKm}
                  hotelPriceLevel={hotelPriceLevel}
                  onDaysChange={setDays}
                />
              </motion.div>
            )}

            <motion.div {...fadeUp}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Places to stay nearby</p>
              <PlanHotelSuggestions lat={destination.lat} lng={destination.lng} onResolved={setHotelPriceLevel} />
            </motion.div>

            {suggestedCar && (
              <motion.div {...fadeUp} className="flex flex-col sm:flex-row gap-3 pt-2">
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
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      <ItineraryUnlockModal destination={unlockDestination} onClose={() => setUnlockDestination(null)} />
      <Footer />
    </div>
  );
}
