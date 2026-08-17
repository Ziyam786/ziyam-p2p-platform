'use client';

import React from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';

export default function ItineraryErrorPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-md mx-auto px-4 pt-40 text-center pb-24">
        <p className="text-gray-700 font-semibold mb-2">Something went wrong</p>
        <p className="text-gray-500 text-sm mb-6">We couldn't process that itinerary unlock. If you were charged, contact support and we'll sort it out.</p>
        <a href="/#itineraries" className="text-amber-500 underline font-semibold">Back to home</a>
      </div>
      <Footer />
    </div>
  );
}
