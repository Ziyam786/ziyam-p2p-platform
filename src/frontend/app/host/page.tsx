import React from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import PageHero from '../../components/PageHero';

const HOST_SHARE = 0.7; // 70% to host, 30% platform commission — see payoutEngine.ts's splitAmount
const ASSUMED_BOOKED_DAYS_PER_MONTH = 18; // ~60% utilization — a stated assumption, not a guarantee

// Real seeded listings (GET /cars), one per category, so this table reflects
// actual platform pricing rather than invented numbers.
const EARNINGS_EXAMPLES = [
  { category: 'Hatchback', model: 'Maruti Swift', dailyRate: 1199 },
  { category: 'SUV', model: 'Hyundai Creta', dailyRate: 2499 },
  { category: 'SUV', model: 'Mahindra Thar', dailyRate: 2999 },
  { category: 'MUV', model: 'Toyota Innova Crysta', dailyRate: 3499 },
  { category: 'EV', model: 'Tata Nexon EV', dailyRate: 2799 },
  { category: 'Luxury', model: 'Mercedes GLA 200', dailyRate: 8999 },
];

const STEPS = [
  { n: '1', title: 'Create your account', desc: 'Sign up as a host — takes about two minutes.' },
  { n: '2', title: 'Verify KYC & list your car', desc: 'Identity check, then RC, insurance, and PUC for your vehicle.' },
  { n: '3', title: 'Get matched with verified guests', desc: 'Every guest completes Aadhaar OTP or photo-ID KYC before they can book — no exceptions.' },
  { n: '4', title: 'Get paid', desc: 'N+1 payout after trip completion, or bundle into a weekly payout from your dashboard.' },
];

const BENEFITS = [
  { icon: '💰', title: 'Keep 70% of every booking', desc: 'No hidden platform cuts — the split is the same whether you self-host or go fleet-managed.' },
  { icon: '🔒', title: 'Payout guaranteed', desc: 'Fleet-managed cars follow our N+1 policy — your payout is never left waiting on a stalled booking.' },
  { icon: '🪪', title: 'Every guest is verified', desc: 'Aadhaar OTP or photo-ID KYC is mandatory before anyone can book.' },
  { icon: '🎛️', title: 'You stay in control', desc: 'Set your own price, availability, and delivery terms. Pause anytime.' },
  { icon: '📍', title: 'Currently live in Bengaluru', desc: 'Expanding pan-India as the fleet grows.' },
];

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export default function HostLandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      <PageHero
        eyebrow="For Hosts"
        title="Turn your idle car into a monthly income stream"
        subtitle="List your car on Ziyam SelfDrive and keep 70% of every booking — verified guests, guaranteed payouts, full control."
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href="/host/onboarding" className="btn-gradient text-white font-bold px-6 py-3 rounded-xl transition text-sm">
            Start Hosting
          </a>
          <a
            href="/host/earnings-calculator"
            className="bg-white/10 hover:bg-white/15 text-white font-bold px-6 py-3 rounded-xl transition text-sm border border-white/20"
          >
            Calculate my earnings
          </a>
        </div>
      </PageHero>

      {/* Earnings table */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2 text-center">What hosts are earning right now</h2>
          <p className="text-gray-500 text-sm text-center mb-8">
            Real listing prices on the platform today, at {ASSUMED_BOOKED_DAYS_PER_MONTH} booked days/month (~60% utilization) and your 70% share.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 font-bold">Category</th>
                  <th className="px-5 py-3 font-bold">Example vehicle</th>
                  <th className="px-5 py-3 font-bold">Daily rate</th>
                  <th className="px-5 py-3 font-bold">Est. monthly earnings (70%)</th>
                </tr>
              </thead>
              <tbody>
                {EARNINGS_EXAMPLES.map((row) => (
                  <tr key={row.model} className="border-t border-gray-100">
                    <td className="px-5 py-3 text-gray-600">{row.category}</td>
                    <td className="px-5 py-3 font-semibold text-gray-900">{row.model}</td>
                    <td className="px-5 py-3 text-gray-600">{money(row.dailyRate)}/day</td>
                    <td className="px-5 py-3 font-bold text-emerald-600">
                      {money(row.dailyRate * ASSUMED_BOOKED_DAYS_PER_MONTH * HOST_SHARE)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-400 text-xs text-center mt-4">
            Estimates only — actual bookings vary by season, location, and demand. Not a guaranteed income.
          </p>
        </div>
      </section>

      {/* 4-step process */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-8 text-center">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-extrabold text-sm flex items-center justify-center mb-3">
                  {s.n}
                </div>
                <p className="font-bold text-gray-900 text-sm mb-1">{s.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits grid */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-8 text-center">Why host with Ziyam</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
                <span className="text-2xl block mb-2">{b.icon}</span>
                <p className="font-bold text-gray-900 text-sm mb-1">{b.title}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commission breakdown */}
      <section className="py-16 bg-gray-950 text-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold mb-8 text-center">Where the money goes</h2>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-white/10 border-b border-white/10">
              <div className="p-5 text-center">
                <p className="text-3xl font-extrabold text-emerald-400">70%</p>
                <p className="text-gray-400 text-xs mt-1">to you, on every booking</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-3xl font-extrabold text-gray-300">30%</p>
                <p className="text-gray-400 text-xs mt-1">Ziyam's platform commission</p>
              </div>
            </div>
            <div className="p-5 flex items-start gap-3">
              <span className="text-xl">🛡️</span>
              <div>
                <p className="font-bold text-sm mb-1">Security deposits & damage reimbursements: 0% Ziyam cut</p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Deposits and damage recovery money pass through to you in full — the platform doesn't take a
                  commission on either.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="bg-gray-950 text-white rounded-2xl p-8">
            <h3 className="text-xl font-extrabold mb-2">Ready to start earning?</h3>
            <p className="text-gray-400 text-sm mb-6">Sign up and list your first car in a few minutes.</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a href="/host/onboarding" className="btn-gradient text-white font-bold px-6 py-3 rounded-xl transition text-sm">
                Start Hosting
              </a>
              <a href="/host/faq" className="text-amber-400 hover:underline text-sm font-semibold">
                Read the Host FAQ →
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
