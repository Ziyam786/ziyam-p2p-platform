'use client';

import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';
import { useToast } from '../../components/Toast';

const TOPICS = [
  { icon: '🚗', title: 'Booking Issues', desc: 'Trouble booking, cancelling, or modifying a trip' },
  { icon: '💳', title: 'Payments & Refunds', desc: 'Payment failures, deposit release, invoices' },
  { icon: '🪪', title: 'KYC & Verification', desc: 'Document upload or verification stuck' },
  { icon: '🚘', title: 'Host Support', desc: 'Listing, payouts, or vehicle management help' },
  { icon: '🔧', title: 'Vehicle Issues', desc: 'Breakdown, accident, or roadside assistance' },
  { icon: '🛡️', title: 'Trust & Safety', desc: 'Report a concern about a trip or user' },
];

const FAQS = [
  { q: 'How do I cancel a booking?', a: 'Go to My Trips → select the trip → Cancel Booking. Free cancellation up to 24 hours before pickup.' },
  { q: 'When is my security deposit refunded?', a: 'Deposits are released within 24-48 hours after a clean vehicle return, following the N+1 settlement cycle.' },
  { q: 'What if the host cancels on me?', a: 'You get a full refund instantly and priority rebooking assistance from our support team.' },
  { q: 'Is roadside assistance included?', a: 'Yes — 24/7 roadside support is included with every booking, regardless of protection plan.' },
];

export default function SupportPage() {
  const { show } = useToast();
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    show('Message sent — our team will get back within 24 hours.', 'success');
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="We're here to help" title="Help Center" subtitle="Find answers fast, or reach our support team directly." />

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-16">
            {TOPICS.map((t) => (
              <div key={t.title} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:border-amber-300 transition cursor-pointer">
                <span className="text-2xl block mb-2">{t.icon}</span>
                <h3 className="font-bold text-sm text-gray-900">{t.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 mb-6">Frequently Asked Questions</h2>
              <div className="space-y-3">
                {FAQS.map((f) => (
                  <details key={f.q} className="group bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 cursor-pointer">
                    <summary className="font-semibold text-gray-800 text-sm flex justify-between items-center list-none">
                      {f.q}
                      <span className="text-amber-500 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <p className="text-gray-600 text-sm mt-3 leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>

            <div id="contact">
              <h2 className="text-xl font-extrabold text-gray-900 mb-6">Contact Us</h2>
              <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6">
                {submitted ? (
                  <div className="text-center py-8">
                    <span className="text-4xl block mb-3">✅</span>
                    <p className="font-semibold text-gray-800">Message sent!</p>
                    <p className="text-sm text-gray-500 mt-1">We typically respond within 24 hours.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <input required placeholder="Your name" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <input required type="email" placeholder="Your email" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <textarea required rows={4} placeholder="How can we help?" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <button type="submit" className="w-full btn-gradient text-white font-bold py-3 rounded-xl transition">
                      Send Message
                    </button>
                  </form>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-4 text-center">
                Or email us directly at <a href="mailto:eightlinesfleet@gmail.com" className="text-amber-500 hover:underline">eightlinesfleet@gmail.com</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
