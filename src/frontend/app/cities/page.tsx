import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';

const LIVE_CITIES = [{ name: 'Bengaluru', emoji: '🏙️' }];

const COMING_SOON_CITIES = [
  { name: 'Mumbai', emoji: '🌊' },
  { name: 'Delhi NCR', emoji: '🕌' },
  { name: 'Hyderabad', emoji: '🏯' },
  { name: 'Chennai', emoji: '🎭' },
  { name: 'Pune', emoji: '🎓' },
  { name: 'Kolkata', emoji: '🌉' },
];

export default function CitiesPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="Now Live" title="Cities We Serve" subtitle="Currently operating in Bengaluru — expanding pan-India as our fleet grows." />

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-10">
            {LIVE_CITIES.map((c) => (
              <a
                key={c.name}
                href={`/cities/${encodeURIComponent(c.name)}`}
                className="bg-gray-50 rounded-2xl p-5 border border-amber-400 hover:shadow-md transition text-center relative"
              >
                <span className="absolute top-2 right-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">LIVE</span>
                <span className="text-3xl block mb-2">{c.emoji}</span>
                <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
              </a>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-gray-500 mb-4">Coming Soon</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {COMING_SOON_CITIES.map((c) => (
              <div
                key={c.name}
                className="bg-gray-50 rounded-2xl p-5 border border-gray-100 text-center opacity-60"
              >
                <span className="text-3xl block mb-2 grayscale">{c.emoji}</span>
                <p className="font-semibold text-gray-500 text-sm">{c.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
