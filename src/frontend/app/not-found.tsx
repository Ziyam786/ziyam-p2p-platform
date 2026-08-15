import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center">
        <span className="text-6xl mb-4">🚗💨</span>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">404 — Wrong Turn</h1>
        <p className="text-gray-500 max-w-md mb-8">
          This page took a detour. The road you're looking for doesn't exist or has moved.
        </p>
        <div className="flex gap-3">
          <a href="/" className="btn-gradient text-white font-bold px-6 py-3 rounded-xl transition">
            Back Home
          </a>
          <a href="/cars" className="border border-gray-200 text-gray-700 hover:border-amber-400 font-bold px-6 py-3 rounded-xl transition">
            Browse Cars
          </a>
        </div>
      </div>
      <Footer />
    </div>
  );
}
