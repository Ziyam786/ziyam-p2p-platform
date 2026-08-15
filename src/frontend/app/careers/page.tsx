import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';

const ROLES = [
  { title: 'Senior Backend Engineer (Node.js)', team: 'Engineering', location: 'Bengaluru / Remote', type: 'Full-time' },
  { title: 'Product Designer', team: 'Design', location: 'Bengaluru', type: 'Full-time' },
  { title: 'Fleet Operations Manager', team: 'Operations', location: 'Mumbai', type: 'Full-time' },
  { title: 'Trust & Safety Associate', team: 'Trust & Safety', location: 'Remote', type: 'Full-time' },
  { title: 'Growth Marketing Intern', team: 'Marketing', location: 'Bengaluru', type: 'Internship' },
];

const PERKS = [
  { icon: '💰', label: 'Competitive salary + ESOPs' },
  { icon: '🚗', label: 'Free ZiyamSelfDrive credits' },
  { icon: '🏥', label: 'Health insurance for you & family' },
  { icon: '🏡', label: 'Flexible / remote-friendly' },
  { icon: '📚', label: 'Learning & book budget' },
  { icon: '🌴', label: 'Unlimited paid time off' },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="Join Eightlines" title="Help us build the future of mobility" subtitle="Small team, big impact — we're hiring across engineering, design, and operations." />

      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-8 text-center">Why work here</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-16">
            {PERKS.map((p) => (
              <div key={p.label} className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
                <span className="text-2xl block mb-2">{p.icon}</span>
                <span className="text-xs font-medium text-gray-700">{p.label}</span>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-6 text-center">Open Roles</h2>
          <div className="space-y-3">
            {ROLES.map((r) => (
              <div key={r.title} className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 rounded-xl p-5 border border-gray-100 hover:border-amber-300 transition">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{r.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{r.team} · {r.location} · {r.type}</p>
                </div>
                <a href="mailto:careers@ziyam.in" className="text-amber-500 font-semibold text-sm hover:underline shrink-0">
                  Apply →
                </a>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-400 mt-8">
            Don't see your role? Write to us at <a href="mailto:careers@ziyam.in" className="text-amber-500 hover:underline">careers@ziyam.in</a>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
