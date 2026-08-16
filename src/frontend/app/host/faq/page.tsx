'use client';

import React, { useState } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import PageHero from '../../../components/PageHero';

const CATEGORIES: { title: string; icon: string; faqs: { q: string; a: string }[] }[] = [
  {
    title: 'Getting Started',
    icon: '🚗',
    faqs: [
      { q: 'What are the requirements to list my car?', a: 'Your car must be under 6 years old with under 50,000 km, roadworthy, and carry a valid RC, active comprehensive insurance, and a valid PUC certificate. See our full Host Policy for details.' },
      { q: 'How long does verification take?', a: 'KYC verification is usually instant via DigiLocker. Vehicle document verification (RC/insurance/PUC) typically completes within a few hours of upload.' },
      { q: "What's the difference between Self-Hosted and Fleet-Managed?", a: "Self-Hosted means you handle your own bookings and handovers. Fleet-Managed means a Ziyam fleet operator manages guest handovers and logistics for you — useful if you own multiple cars or don't have time to manage bookings yourself." },
      { q: 'Can I list more than one car?', a: 'Yes — there\'s no limit. Hosts with multiple vehicles often opt into Fleet-Managed for the cars they don\'t have time to personally manage.' },
    ],
  },
  {
    title: 'Earnings & Payouts',
    icon: '💰',
    faqs: [
      { q: 'How much do I earn per booking?', a: 'You keep 70% of every booking; ZiyamSelfDrive\'s commission is 30%. This is the same for both Self-Hosted and Fleet-Managed cars.' },
      { q: 'When do I actually get paid?', a: "If you're self-hosted, 24-48 hours after trip completion (or weekly, if you opt into weekly payouts). If you're fleet-managed, within 1 business day of your fleet operator confirming they've received a clear payout from the platform." },
      { q: 'Why is there a delay before payout?', a: 'The N+1 timeline exists so payouts only go out once the underlying payment has actually cleared — this protects hosts from chargebacks and protects the platform from fraud. We never make advance payouts without a confirmed receipt.' },
      { q: 'How do I add my bank account?', a: "From your host dashboard, under Payout Settings. We verify the account with a small penny-drop transaction before it's eligible to receive payouts." },
      { q: 'Can I choose weekly payouts instead of per-trip?', a: 'Yes, if you\'re self-hosted — toggle this from your dashboard. Fleet-managed cars follow the 1-day-after-receipt timeline instead.' },
    ],
  },
  {
    title: 'Insurance & Damage',
    icon: '🛡️',
    faqs: [
      { q: 'Does ZiyamSelfDrive insure my car?', a: "No — we're a marketplace, not an insurer. Your own comprehensive insurance policy is the primary coverage, and it's mandatory to list a car. See our Insurance & Damage Policy page for the full breakdown." },
      { q: "What happens if a renter damages my car?", a: 'The cost is deducted from the security deposit first. If it exceeds the deposit, you recover the remainder directly from the renter — our support team helps coordinate this and will try to cover up to ₹20,000 of a claim.' },
      { q: "What if my car breaks down or is abandoned by a renter?", a: "24/7 roadside assistance is included on every trip regardless of protection plan — we'll get the vehicle recovered to the nearest garage." },
      { q: 'Do I need to renew my insurance to keep my listing active?', a: 'Yes — an expired insurance policy will pause your listing until you upload a renewed one.' },
    ],
  },
  {
    title: 'Managing Your Vehicle',
    icon: '🔧',
    faqs: [
      { q: 'How do I block out dates when my car is unavailable?', a: "Use the availability calendar in your dashboard — tap a start and end date to pause bookings for that range. Renters can't book over dates you've blocked." },
      { q: 'Can I change my price after listing?', a: "Yes, but pricing is set via a slider bounded to market rate for your car's category and city — you can't type an arbitrary price. This keeps pricing fair and competitive." },
      { q: 'How do I offer doorstep delivery?', a: 'Toggle it on from your car\'s edit page in the dashboard and set your delivery fee — you can enable this any time after listing, not just at onboarding.' },
      { q: 'What if I need to take my car in for service?', a: "Block those dates on your availability calendar like any other pause. If you're fleet-managed, your fleet operator handles scheduling maintenance." },
    ],
  },
  {
    title: 'Trust & Safety',
    icon: '🪪',
    faqs: [
      { q: 'How are renters verified?', a: 'Every renter completes mandatory KYC via DigiLocker/Aadhaar before their first booking — the same verification standard hosts go through.' },
      { q: 'How does the trip handover code work?', a: "When a trip starts, a 4-digit code is shown only in your host app. The guest must enter this code to mark the trip complete when returning the car — this proves an actual in-person handover happened, protecting both sides from disputes." },
      { q: 'What if a guest tries to arrange a rental outside the platform?', a: "Don't. Off-platform arrangements void KYC verification, payout protection, and support coverage for that trip — if something goes wrong, you're on your own." },
      { q: 'Can I refer other hosts?', a: 'Yes — you earn ₹500 in platform credit once someone you refer completes their first trip.' },
    ],
  },
];

export default function HostFaqPage() {
  const [openCategory, setOpenCategory] = useState(CATEGORIES[0].title);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="For Hosts" title="Host FAQ" subtitle="Straight answers on earnings, payouts, insurance, and managing your listing." />

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-wrap gap-2 mb-10">
            {CATEGORIES.map((c) => (
              <button
                key={c.title}
                onClick={() => setOpenCategory(c.title)}
                className={`text-sm font-semibold px-4 py-2 rounded-full border transition ${
                  openCategory === c.title ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 text-gray-600 hover:border-amber-300'
                }`}
              >
                {c.icon} {c.title}
              </button>
            ))}
          </div>

          {CATEGORIES.filter((c) => c.title === openCategory).map((c) => (
            <div key={c.title} className="space-y-3">
              {c.faqs.map((f) => (
                <details key={f.q} className="group bg-gray-50 border border-gray-100 rounded-xl px-5 py-4">
                  <summary className="font-semibold text-gray-800 text-sm flex justify-between items-center list-none cursor-pointer">
                    {f.q}
                    <span className="text-amber-500 group-open:rotate-180 transition-transform shrink-0 ml-3">▼</span>
                  </summary>
                  <p className="text-gray-600 text-sm mt-3 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          ))}

          <div className="bg-gray-950 text-white rounded-2xl p-6 mt-12 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold mb-1">Still have questions?</h3>
              <p className="text-sm text-gray-400">Read the full <a href="/host/policy" className="text-amber-400 hover:underline">Host Policy</a> or contact support directly.</p>
            </div>
            <a href="/support#contact" className="border border-gray-700 hover:border-amber-400 text-white font-bold px-6 py-3 rounded-xl transition text-sm whitespace-nowrap">
              Contact Support
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
