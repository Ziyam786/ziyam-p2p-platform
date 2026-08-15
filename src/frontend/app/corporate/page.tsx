import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';

const BENEFITS = [
  { icon: '🧾', title: 'Consolidated Billing', desc: 'One monthly invoice for all employee trips, GST-compliant.' },
  { icon: '👥', title: 'Team Accounts', desc: 'Add employees, set spend limits, and approve bookings centrally.' },
  { icon: '📊', title: 'Usage Dashboards', desc: 'Track mileage, spend, and utilization per department in real time.' },
  { icon: '🎯', title: 'Negotiated Rates', desc: 'Volume-based discounts for teams booking 20+ trips a month.' },
  { icon: '🛎️', title: 'Priority Support', desc: 'Dedicated account manager and 1-hour response SLA.' },
  { icon: '🚙', title: 'Fleet Options', desc: 'Long-term corporate leases available through our fleet partners.' },
];

export default function CorporatePage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="Ziyam for Business" title="Corporate Rentals" subtitle="Simplify business travel with self-drive rentals your finance team will love." />

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-16">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <span className="text-3xl block mb-3">{b.icon}</span>
                <h3 className="font-bold text-gray-900 text-sm mb-2">{b.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-950 text-white rounded-2xl p-8 text-center">
            <h3 className="font-bold text-lg mb-2">Set up a corporate account</h3>
            <p className="text-gray-400 text-sm mb-4">Our team will reach out within one business day to get you started.</p>
            <a href="mailto:business@ziyam.in" className="btn-gradient text-white font-bold px-6 py-3 rounded-xl inline-block transition">
              Contact Sales
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
