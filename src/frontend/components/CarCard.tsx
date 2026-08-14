import React from 'react';

export interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  category: 'Hatchback' | 'Sedan' | 'SUV' | 'Luxury' | 'EV' | 'MUV';
  transmission: 'Manual' | 'Automatic';
  fuelType: 'Petrol' | 'Diesel' | 'Electric' | 'CNG';
  seats: number;
  pricePerDay: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  city: string;
  available: boolean;
  kmIncluded: number;
  extraKmCharge: number;
}

interface CarCardProps {
  car: Car;
  onBook?: (carId: string) => void;
}

const FUEL_ICONS: Record<string, string> = {
  Petrol: '⛽',
  Diesel: '🛢️',
  Electric: '⚡',
  CNG: '💨',
};

export default function CarCard({ car, onBook }: CarCardProps) {
  const stars = Math.round(car.rating);
  return (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition overflow-hidden flex flex-col border border-gray-100">
      {/* Image */}
      <div className="relative h-44 bg-gray-100 overflow-hidden">
        <img
          src={car.imageUrl || '/placeholder-car.jpg'}
          alt={`${car.make} ${car.model}`}
          className="w-full h-full object-cover"
        />
        {!car.available && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-sm bg-red-500 px-3 py-1 rounded-full">Booked</span>
          </div>
        )}
        <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {car.category}
        </span>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-1">
          <div>
            <h3 className="font-bold text-gray-900 text-base">{car.make} {car.model}</h3>
            <p className="text-xs text-gray-500">{car.year} · {car.city}</p>
          </div>
          <div className="text-right">
            <span className="text-amber-500 font-extrabold text-lg">₹{car.pricePerDay.toLocaleString()}</span>
            <p className="text-xs text-gray-400">/day</p>
          </div>
        </div>

        {/* Specs row */}
        <div className="flex items-center gap-3 text-xs text-gray-600 mt-2 mb-3 flex-wrap">
          <span>{FUEL_ICONS[car.fuelType]} {car.fuelType}</span>
          <span>•</span>
          <span>🔧 {car.transmission}</span>
          <span>•</span>
          <span>💺 {car.seats} Seats</span>
          <span>•</span>
          <span>🛣️ {car.kmIncluded} km/day</span>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-4">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                className={`w-3.5 h-3.5 ${i < stars ? 'text-amber-400' : 'text-gray-200'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-xs text-gray-500 ml-1">{car.rating.toFixed(1)} ({car.reviewCount})</span>
        </div>

        <div className="mt-auto flex items-center gap-2">
          <a
            href={`/cars/${car.id}`}
            className="flex-1 text-center border border-amber-500 text-amber-500 hover:bg-amber-50 text-sm font-semibold py-2 rounded-xl transition"
          >
            View Details
          </a>
          {onBook ? (
            <button
              disabled={!car.available}
              onClick={() => onBook(car.id)}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold py-2 rounded-xl transition"
            >
              Book Now
            </button>
          ) : car.available ? (
            <a
              href={`/cars/${car.id}`}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-center text-white text-sm font-bold py-2 rounded-xl transition"
            >
              Book Now
            </a>
          ) : (
            <span className="flex-1 bg-gray-200 text-center text-gray-400 text-sm font-bold py-2 rounded-xl cursor-not-allowed">
              Unavailable
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
