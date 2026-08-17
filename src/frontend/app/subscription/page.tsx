import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';

const PLANS = [
  {
    name: 'Weekender',
    price: '₹6,999',
    period: '/month',
    desc: 'For occasional trips',
    features: ['4 days of rental / month', 'Hatchback or Sedan category', 'Rollover up to 2 unused days', 'Standard protection included'],
  },
  {
    name: 'Commuter',
    price: '₹14,999',
    period: '/month',
    desc: 'Most popular for regular drivers',
    features: ['10 days of rental / month', 'Any category up to SUV', 'Rollover up to 4 unused days', 'Standard protection included', 'Priority instant booking'],
    highlight: true,
  },
  {
    name: 'Unlimited',
    price: '₹34,999',
    period: '/month',
    desc: 'For power users & small teams',
    features: ['Unlimited rental days', 'Any category incl. Luxury', 'No rollover cap', 'Premium protection included', 'Dedicated support line'],
  },
];

export default function SubscriptionPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="Skip the per-trip pricing" title="Subscription Plans" subtitle="Predictable monthly pricing for lessees who drive often." />

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl p-6 border-2 ${p.highlight ? 'border-amber-500 bg-amber-50 shadow-lg' : 'border-gray-100 bg-gray-50'}`}
              >
                {p.highlight && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="font-extrabold text-xl text-gray-900 mt-3">{p.name}</h3>
                <p className="text-xs text-gray-500 mb-4">{p.desc}</p>
                <div className="mb-5">
                  <span className="text-3xl font-extrabold text-gray-900">{p.price}</span>
                  <span className="text-gray-400 text-sm">{p.period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-emerald-500 font-bold">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="/signup"
                  className={`block text-center font-bold py-3 rounded-xl transition text-sm ${
                    p.highlight ? 'btn-gradient text-white' : 'border border-gray-300 text-gray-700 hover:border-amber-400'
                  }`}
                >
                  Choose {p.name}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
