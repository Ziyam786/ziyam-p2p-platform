'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import Navbar from '../../../../../components/Navbar';
import Footer from '../../../../../components/Footer';
import ProtectedRoute from '../../../../../components/ProtectedRoute';
import Tabs from '../../../../../components/Tabs';
import BlackoutManager from '../../../../../components/BlackoutManager';
import BookingPreferences from '../../../../../components/BookingPreferences';
import RatingsPanel from '../../../../../components/RatingsPanel';
import IncentivesPanel from '../../../../../components/IncentivesPanel';
import CarLocationMap, { directionsUrl } from '../../../../../components/CarLocationMap';
import VehicleServices from '../../../../../components/VehicleServices';
import FleetOnboardingPanel from '../../../../../components/FleetOnboardingPanel';
import { useAuth } from '../../../../../lib/auth-context';
import { useToast } from '../../../../../components/Toast';
import { carsApi } from '../../../../../lib/api';
import type { Car } from '../../../../../lib/types';

function ManageCarInner() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { show } = useToast();
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('controls');
  const [showBlackout, setShowBlackout] = useState(false);

  useEffect(() => {
    carsApi.get(params.id).then((res) => setCar(res.data)).finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <p className="text-center pt-32 text-gray-400">Loading…</p>;
  if (!car) return <p className="text-center pt-32 text-gray-400">Car not found.</p>;
  if (user && car.ownerId !== user.id) {
    return <p className="text-center pt-32 text-gray-400">You don't have access to manage this listing.</p>;
  }

  async function toggleAvailability() {
    if (!car) return;
    try {
      const res = await carsApi.update(car.id, { isAvailable: !car.isAvailable });
      setCar(res.data);
      show(res.data.isAvailable ? 'Listing is live' : 'Listing paused', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to update listing', 'error');
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-28 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="text-xs text-gray-400 font-mono">{car.registrationNo}</p>
          <h1 className="text-2xl font-extrabold text-gray-900">{car.make} {car.model}</h1>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 ${
          car.verificationStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
        }`}>
          {car.verificationStatus === 'VERIFIED' ? '✓ Verified' : 'Verification Pending'}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-500 mb-6">
        <span>★ {car.rating.toFixed(2)} ({car.reviewCount})</span>
        <span>·</span>
        <span className={car.isAvailable ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
          {car.isAvailable ? 'Listing Live' : 'Paused'}
        </span>
      </div>

      {car.images[0] && (
        <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-gray-100 mb-6">
          <Image src={car.images[0]} alt="" fill sizes="(max-width: 768px) 100vw, 700px" className="object-cover" />
        </div>
      )}

      {/* Lock/Unlock are decorative — real remote commands only fire during an active trip (see booking.routes.ts /unlock). Navigate is real, via Google Maps. */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <button disabled className="border border-gray-200 text-gray-400 rounded-xl py-2.5 text-sm font-semibold cursor-not-allowed" title="Available during an active trip">
          🔒 Lock
        </button>
        <button disabled className="border border-gray-200 text-gray-400 rounded-xl py-2.5 text-sm font-semibold cursor-not-allowed" title="Available during an active trip">
          🔓 Unlock
        </button>
        {car.latitude && car.longitude ? (
          <a href={directionsUrl(car.latitude, car.longitude)} target="_blank" rel="noopener noreferrer" className="border border-gray-200 text-gray-700 hover:border-amber-400 rounded-xl py-2.5 text-sm font-semibold text-center transition">
            🧭 Navigate
          </a>
        ) : (
          <a href={`/cars/${car.id}`} className="border border-gray-200 text-gray-700 hover:border-amber-400 rounded-xl py-2.5 text-sm font-semibold text-center transition">
            📍 View Listing
          </a>
        )}
      </div>

      {car.latitude && car.longitude && (
        <div className="mb-8">
          <CarLocationMap latitude={car.latitude} longitude={car.longitude} label={`${car.make} ${car.model}`} />
        </div>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'controls', label: 'Controls' },
          { key: 'preferences', label: 'Booking Preferences' },
          { key: 'incentives', label: 'Incentives' },
          { key: 'services', label: 'Vehicle Services' },
          { key: 'ratings', label: 'Ratings & Reviews' },
          { key: 'fleet', label: car.fleetManaged ? 'Fleet Program ✓' : 'Fleet Program' },
        ]}
      />

      <div className="pt-6">
        {tab === 'controls' && (
          <div className="space-y-3">
            <ControlRow icon="📅" title="Your Listings & Pause Dates" sub="Block off dates when this car isn't available" onClick={() => setShowBlackout(true)} />
            <ControlRow icon="💰" title="Pricing & Photos" sub="Edit rate, photos, features, and documents" href={`/host/cars/${car.id}/edit`} />
            <ControlRow
              icon={car.isAvailable ? '⏸️' : '▶️'}
              title={car.isAvailable ? 'Pause This Listing' : 'Reactivate This Listing'}
              sub={car.isAvailable ? 'Hide this car from search temporarily' : 'Make this car bookable again'}
              onClick={toggleAvailability}
            />
            <ControlRow icon="🪪" title="Documents" sub={car.verificationStatus === 'VERIFIED' ? 'RC, PUC & Insurance on file' : 'Add RC, PUC & Insurance to get verified'} href={`/host/cars/${car.id}/edit`} />
          </div>
        )}

        {tab === 'preferences' && <BookingPreferences car={car} onUpdated={setCar} />}

        {tab === 'incentives' && <IncentivesPanel car={car} />}

        {tab === 'services' && <VehicleServices car={car} />}

        {tab === 'ratings' && <RatingsPanel car={car} />}

        {tab === 'fleet' && <FleetOnboardingPanel car={car} />}
      </div>

      {showBlackout && <BlackoutManager car={car} onClose={() => setShowBlackout(false)} />}
    </div>
  );
}

function ControlRow({ icon, title, sub, href, onClick }: { icon: string; title: string; sub: string; href?: string; onClick?: () => void }) {
  const content = (
    <div className="flex items-center gap-4 border border-gray-100 hover:border-amber-200 rounded-xl px-4 py-3.5 transition cursor-pointer">
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-bold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
      <span className="text-gray-300">›</span>
    </div>
  );
  return href ? <a href={href}>{content}</a> : <button type="button" onClick={onClick} className="w-full text-left">{content}</button>;
}

export default function ManageCarPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <ProtectedRoute roles={['SELF_HOST', 'FLEET_OPERATOR']}>
        <ManageCarInner />
      </ProtectedRoute>
      <Footer />
    </div>
  );
}
