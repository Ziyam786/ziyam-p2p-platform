'use client';

import React from 'react';
import Rating from './Rating';
import { useAuth } from '../lib/auth-context';
import { useWishlist } from '../lib/wishlist-context';
import type { Car } from '../lib/types';

interface CarCardProps {
  car: Car;
}

const FUEL_ICONS: Record<string, string> = {
  Petrol: '⛽',
  Diesel: '🛢️',
  Electric: '⚡',
  CNG: '💨',
};

export default function CarCard({ car }: CarCardProps) {
  const image = car.images?.[0] ?? '/placeholder-car.jpg';
  const { user } = useAuth();
  const { isWishlisted, toggle } = useWishlist();
  const wishlisted = isWishlisted(car.id);

  async function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      window.location.href = `/login?redirect=/cars/${car.id}`;
      return;
    }
    toggle(car.id).catch(() => {});
  }

  return (
    <div className="card-elevated group bg-white rounded-2xl overflow-hidden flex flex-col border border-gray-100">
      {/* Image */}
      <div className="relative h-44 bg-gray-100 overflow-hidden">
        <img
          src={image}
          alt={`${car.make} ${car.model}`}
          loading="lazy"
          decoding="async"
          width={400}
          height={280}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110 will-change-transform"
        />
        {!car.isAvailable && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-sm bg-red-500 px-3 py-1 rounded-full">Booked</span>
          </div>
        )}
        <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {car.category}
        </span>
        {car.instantBook && (
          <span className="absolute top-3 right-3 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            ⚡ Instant Book
          </span>
        )}
        <button
          onClick={handleWishlist}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center transition"
        >
          <span className={wishlisted ? 'text-red-500' : 'text-gray-400'}>{wishlisted ? '♥' : '♡'}</span>
        </button>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1">
          <div>
            <h3 className="font-bold text-gray-900 text-base">{car.make} {car.model}</h3>
            <p className="text-xs text-gray-500">{car.year} · {car.city}</p>
          </div>
          <div className="text-right">
            <span className="text-amber-500 font-extrabold text-lg">₹{car.dailyRate.toLocaleString()}</span>
            <p className="text-xs text-gray-400">/day</p>
          </div>
        </div>

        {/* Specs row */}
        <div className="flex items-center gap-3 text-xs text-gray-600 mt-2 mb-3 flex-wrap">
          <span>{FUEL_ICONS[car.fuelType] ?? '⛽'} {car.fuelType}</span>
          <span>•</span>
          <span>🔧 {car.transmission}</span>
          <span>•</span>
          <span>💺 {car.seats} Seats</span>
          <span>•</span>
          <span>🛣️ {car.kmIncludedPerDay} km/day</span>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {car.securityDeposit === 0 && (
            <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">💰 Zero Deposit</span>
          )}
          {car.offersDelivery && (
            <span className="bg-purple-50 text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full">🚚 Delivery Available</span>
          )}
        </div>

        <div className="mb-4">
          <Rating value={car.rating} count={car.reviewCount} />
        </div>

        <div className="mt-auto flex items-center gap-2">
          <a
            href={`/cars/${car.id}`}
            className="flex-1 text-center border border-amber-500 text-amber-500 hover:bg-amber-50 text-sm font-semibold py-2 rounded-xl transition"
          >
            View Details
          </a>
          <a
            href={`/cars/${car.id}`}
            aria-disabled={!car.isAvailable}
            className={`flex-1 text-center text-sm font-bold py-2 rounded-xl ${
              car.isAvailable
                ? 'btn-gradient text-white'
                : 'bg-gray-200 text-gray-400 pointer-events-none transition'
            }`}
          >
            Book Now
          </a>
        </div>
      </div>
    </div>
  );
}
