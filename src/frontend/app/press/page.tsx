import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';

const COVERAGE = [
  { outlet: 'The Economic Times', title: 'ZiyamSelfDrive brings peer-to-peer car sharing to tier-2 India', date: 'Jan 2026' },
  { outlet: 'YourStory', title: 'How Eightlines is rethinking self-drive rentals with a 70/30 host-first model', date: 'Nov 2025' },
  { outlet: 'Inc42', title: 'Self-drive rental startups see a surge as commuters ditch ownership', date: 'Aug 2025' },
  { outlet: 'MoneyControl', title: 'Peer-to-peer mobility platforms report record bookings this festive season', date: 'Oct 2025' },
];

export default function PressPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="Newsroom" title="Press & Media" subtitle="Coverage, brand assets, and media contacts for ZiyamSelfDrive." />

      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-xl font-extrabold text-gray-900 mb-6">In the News</h2>
          <div className="space-y-4 mb-14">
            {COVERAGE.map((c) => (
              <div key={c.title} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span className="font-semibold text-amber-500">{c.outlet}</span>
                  <span>{c.date}</span>
                </div>
                <p className="text-sm font-medium text-gray-800">{c.title}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-950 text-white rounded-2xl p-8 text-center">
            <h3 className="font-bold text-lg mb-2">Media Enquiries</h3>
            <p className="text-gray-400 text-sm mb-4">For interviews, brand assets, or data requests, reach our comms team directly.</p>
            <a href="mailto:press@ziyam.in" className="text-amber-400 font-semibold hover:underline">press@ziyam.in</a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
