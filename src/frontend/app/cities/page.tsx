import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';

const CITIES = [
  { name: 'Bengaluru', emoji: '🏙️', cars: '900+' },
  { name: 'Mumbai', emoji: '🌊', cars: '850+' },
  { name: 'Delhi NCR', emoji: '🕌', cars: '1,100+' },
  { name: 'Hyderabad', emoji: '🏯', cars: '600+' },
  { name: 'Chennai', emoji: '🎭', cars: '520+' },
  { name: 'Pune', emoji: '🎓', cars: '480+' },
  { name: 'Kolkata', emoji: '🌉', cars: '340+' },
  { name: 'Jaipur', emoji: '🏰', cars: '210+' },
  { name: 'Ahmedabad', emoji: '🕌', cars: '260+' },
  { name: 'Kochi', emoji: '🚢', cars: '190+' },
];

export default function CitiesPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="Pan-India" title="Cities We Serve" subtitle="Self-drive rentals available in 30+ cities and growing." />

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {CITIES.map((c) => (
              <a
                key={c.name}
                href={`/cities/${encodeURIComponent(c.name)}`}
                className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:border-amber-400 hover:shadow-md transition text-center"
              >
                <span className="text-3xl block mb-2">{c.emoji}</span>
                <p className="font-semibold text-gray-800 text-sm">{c.name}</p>
                <p className="text-xs text-gray-400 mt-1">{c.cars} cars</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
