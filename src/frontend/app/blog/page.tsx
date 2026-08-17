import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';

const POSTS = [
  { title: '5 things to check before renting a self-drive car', tag: 'Lessee Guide', read: '4 min read', emoji: '✅' },
  { title: 'How the N+1 payout cycle works for hosts', tag: 'Hosting', read: '3 min read', emoji: '💸' },
  { title: 'EV road trips: charging stations across South India', tag: 'Travel', read: '6 min read', emoji: '⚡' },
  { title: "From idle asset to ₹35,000/month: a host's story", tag: 'Hosting', read: '5 min read', emoji: '🚗' },
  { title: 'Monsoon driving checklist for self-drive lessees', tag: 'Safety', read: '3 min read', emoji: '🌧️' },
  { title: 'Instant Book vs. Approval Required — which is right for your fleet?', tag: 'Hosting', read: '4 min read', emoji: '⚙️' },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="Ziyam Blog" title="Stories, guides & road trip ideas" subtitle="From lessee tips to host earnings breakdowns — everything self-drive." />

      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {POSTS.map((p) => (
              <div key={p.title} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition">
                <div className="h-32 bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center text-5xl">
                  {p.emoji}
                </div>
                <div className="p-5">
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">{p.tag}</span>
                  <h3 className="font-bold text-gray-900 text-sm mt-2 mb-2 leading-snug">{p.title}</h3>
                  <p className="text-xs text-gray-400">{p.read}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
