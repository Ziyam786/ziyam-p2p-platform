import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';

const STEPS = [
  {
    step: '01',
    icon: '🔍',
    title: 'Search Your City',
    desc: 'Enter your city, pickup date & drop-off date to see real-time available cars from verified hosts near you.',
    detail: [
      'Currently operating in Bengaluru',
      'Filter by category, fuel type, and transmission',
      'View exact pickup location on map',
    ],
  },
  {
    step: '02',
    icon: '📋',
    title: 'Instant KYC Verification',
    desc: 'Complete a one-time KYC: Aadhaar OTP, or upload your ID. Then upload your driving licence. Arya.ai verifies licence photos, optional liveness selfie, and face match.',
    detail: [
      'Aadhaar OTP eKYC, or PAN / voter ID / passport / Aadhaar photo via Arya.ai',
      'Driving licence extraction and selfie liveness',
      'KYC approved when the chosen identity check and licence check pass',
    ],
  },
  {
    step: '03',
    icon: '💳',
    title: 'Pay Securely',
    desc: 'Pay via UPI, credit/debit card, or net banking. A refundable security deposit is held in escrow.',
    detail: [
      'UPI, cards, net banking & wallets accepted',
      'Security deposit held separately in escrow',
      'Zero-fraud protection via Razorpay',
    ],
  },
  {
    step: '04',
    icon: '🚗',
    title: 'Pick Up & Drive',
    desc: "Meet the host at the pickup point, do a quick vehicle inspection, and you're off. No driver needed.",
    detail: [
      'Host hands over keys at agreed location',
      'App-based digital trip log',
      '24/7 roadside assistance on standby',
    ],
  },
  {
    step: '05',
    icon: '🔑',
    title: 'Return & Deposit Release',
    desc: 'Return the car at the agreed time. After a quick check, your security deposit is released within 24 hours.',
    detail: [
      'Video-documented handover',
      'Deposit released in N+1 settlement cycle',
      'Digital invoice emailed instantly',
    ],
  },
];

const FAQS = [
  {
    q: 'Do I need a driver\'s licence to rent?',
    a: 'Yes. A valid Indian driving licence is mandatory. International licences are accepted for foreign nationals with a valid IDP.',
  },
  {
    q: 'What is the minimum age to rent?',
    a: 'You must be at least 21 years old and hold a valid driving licence for at least 1 year.',
  },
  {
    q: 'Is fuel included in the rental?',
    a: 'No. Cars are handed over with a pre-noted fuel level and must be returned at the same level. The fare covers the car rental only.',
  },
  {
    q: 'What happens if I return the car late?',
    a: 'Late returns are charged at the hourly rate. After 3 hours, a full-day charge applies.',
  },
  {
    q: 'Are there toll or parking charges?',
    a: 'Yes. All tolls, parking fees, and traffic challans during the rental period are the lessee\'s responsibility.',
  },
  {
    q: 'What is the security deposit for?',
    a: 'The security deposit protects against damage, traffic violations, and excessive km overage. It is fully refunded after a clean return.',
  },
];

const HOST_STEPS = [
  { icon: '📝', title: 'Register & List', desc: 'Submit your car details, photos, and pricing — document verification (RC/insurance/PUC) usually completes within a few hours.' },
  { icon: '📅', title: 'Manage Availability', desc: 'Set your calendar, blackout dates, and pricing per season from the Fleet Control Center.' },
  { icon: '💰', title: 'Earn 70%', desc: 'You keep 70% of every booking. Ziyam handles payments, guest verification, and marketing.' },
  { icon: '🏦', title: 'N+1 Payouts', desc: 'Earnings are settled automatically to your linked bank account on an N+1 cycle.' },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      {/* Hero */}
      <section className="bg-gray-950 text-white pt-32 pb-20 text-center px-4">
        <div className="max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-4 block">
            Simple. Transparent. Trusted.
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">How ZiyamSelfDrive Works</h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Rent a self-drive car in under 5 minutes — or list your car and earn passively.
          </p>
        </div>
      </section>

      {/* For Lessees */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">For Lessees</h2>
          <p className="text-gray-500 text-sm text-center mb-12">Your complete guide to renting a self-drive car</p>

          <div className="space-y-10">
            {STEPS.map((s, i) => (
              <div key={s.step} className={`flex flex-col md:flex-row gap-8 items-start ${i % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}>
                <div className="flex-shrink-0 w-full md:w-48 flex flex-col items-center md:items-start">
                  <div className="w-16 h-16 bg-amber-500/10 border border-amber-400/30 rounded-2xl flex items-center justify-center text-3xl mb-2">
                    {s.icon}
                  </div>
                  <span className="text-4xl font-black text-amber-100">{s.step}</span>
                </div>
                <div className="flex-1 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{s.desc}</p>
                  <ul className="space-y-1">
                    {s.detail.map((d) => (
                      <li key={d} className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="text-emerald-500 font-bold">✓</span> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <a
              href="/cars"
              className="inline-block btn-gradient text-white font-bold px-10 py-4 rounded-xl text-base transition shadow-lg"
            >
              Browse Cars Now
            </a>
          </div>
        </div>
      </section>

      {/* For Hosts */}
      <section className="py-20 bg-gray-950 text-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-white mb-2 text-center">For Car Owners</h2>
          <p className="text-gray-400 text-sm text-center mb-12">Turn your idle car into a passive income machine</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {HOST_STEPS.map((s) => (
              <div key={s.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center">
                <div className="text-3xl mb-3">{s.icon}</div>
                <h3 className="font-bold text-white mb-2 text-sm">{s.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <a
              href="/host/dashboard"
              className="inline-block border border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-white font-bold px-10 py-4 rounded-xl text-base transition"
            >
              Start Listing Your Car
            </a>
          </div>
        </div>
      </section>

      {/* Technology */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">Built on Ziyam's Technology Stack</h2>
          <p className="text-gray-500 text-sm text-center mb-12">Four systems working together — not marketing labels, the real infrastructure behind every trip</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-1">Ziyam Axon Network</h3>
              <p className="text-xs text-amber-600 font-semibold mb-2">Supply Gateway</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Routes every search to the right car — availability, blackout dates, city/category matching, and real-time
                pricing across the whole listed fleet.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-1">Ziyam Avya AI</h3>
              <p className="text-xs text-amber-600 font-semibold mb-2">Deeptech Trust Layer</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Our AI assistant — grounded in live booking and inventory data, not generic answers, so what it tells you
                about a car or a trip is actually true right now.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-1">Ziyam Kyro</h3>
              <p className="text-xs text-amber-600 font-semibold mb-2">Execution — Fleet Operator Console</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                The ground-staff app fleet operators run trips on — check-in/handover, ID verification, and cash
                reconciliation, in the field, in real time.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-1">Ziyam Arcs Command</h3>
              <p className="text-xs text-amber-600 font-semibold mb-2">Central Nervous System</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                The command center tying it together — bookings, payouts, KYC review, and the full financial ledger in one
                place for our operations team.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">Frequently Asked Questions</h2>
          <p className="text-gray-500 text-sm text-center mb-10">Everything you need to know</p>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 cursor-pointer"
              >
                <summary className="font-semibold text-gray-800 text-sm flex justify-between items-center list-none">
                  {faq.q}
                  <span className="text-amber-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="text-gray-600 text-sm mt-3 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
