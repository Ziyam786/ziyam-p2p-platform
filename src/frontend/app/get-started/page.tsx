'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import MotionButton from '../../components/MotionButton';
import { carsApi } from '../../lib/api';
import { setStickyDates } from '../../lib/searchDates';

const CITIES = [
  'Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai',
  'Pune', 'Kolkata', 'Jaipur', 'Ahmedabad', 'Kochi',
];

const CATEGORIES = [
  { label: 'Hatchback', icon: '🚘' },
  { label: 'Sedan', icon: '🚗' },
  { label: 'SUV', icon: '🛻' },
  { label: 'Luxury', icon: '🏎️' },
  { label: 'EV', icon: '⚡' },
];

type Path = 'RENT' | 'LIST' | null;

const EASE = [0.22, 1, 0.36, 1] as const;

function StepShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="bg-white rounded-3xl border border-gray-100 shadow-xl p-8 md:p-10"
    >
      {children}
    </motion.div>
  );
}

export default function GetStartedPage() {
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<Path>(null);
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [pulse, setPulse] = useState<{ availableCount: number; averageDailyRate: number | null } | null>(null);
  const [pulseLoading, setPulseLoading] = useState(false);

  useEffect(() => {
    if (step !== 2 || path !== 'RENT' || !city) return;
    let active = true;
    setPulseLoading(true);
    carsApi
      .marketPulse(city)
      .then((res) => active && setPulse(res.data))
      .catch(() => active && setPulse(null))
      .finally(() => active && setPulseLoading(false));
    return () => {
      active = false;
    };
  }, [step, path, city]);

  function browseWithDefaults() {
    const now = new Date();
    const pickup = new Date(now.getTime() + 60 * 60 * 1000);
    const dropoff = new Date(pickup.getTime() + 24 * 60 * 60 * 1000);
    const toVal = (d: Date) => d.toISOString().slice(0, 16);
    setStickyDates(toVal(pickup), toVal(dropoff));
    window.location.href = `/cars?city=${encodeURIComponent(city)}`;
  }

  const totalSteps = 3;
  const progressStep = path === null ? 1 : 2;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 pt-32 pb-24">
        {step > 0 && (
          <div className="flex gap-1.5 mb-8">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i < progressStep ? 'bg-amber-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 0 && (
            <StepShell key="s0">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">Let's get you sorted</p>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-2">What brings you here?</h1>
              <p className="text-gray-500 text-sm mb-8">Two quick questions, then we'll show you exactly what's available — no account needed yet.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setPath('RENT'); setStep(1); }}
                  className="text-left p-6 rounded-2xl border-2 border-gray-100 hover:border-amber-400 hover:bg-amber-50 transition-colors"
                >
                  <span className="text-3xl block mb-3">🚗</span>
                  <p className="font-bold text-gray-900 mb-1">I need a car</p>
                  <p className="text-xs text-gray-500">Rent a verified self-drive car for a trip.</p>
                </motion.button>
                <motion.button
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setPath('LIST'); setStep(1); }}
                  className="text-left p-6 rounded-2xl border-2 border-gray-100 hover:border-amber-400 hover:bg-amber-50 transition-colors"
                >
                  <span className="text-3xl block mb-3">🔑</span>
                  <p className="font-bold text-gray-900 mb-1">I have a car to list</p>
                  <p className="text-xs text-gray-500">Earn 70% of every booking, on your terms.</p>
                </motion.button>
              </div>
            </StepShell>
          )}

          {step === 1 && path === 'RENT' && (
            <StepShell key="s1r">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">Almost there</p>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Which city?</h1>
              <p className="text-gray-500 text-sm mb-6">We'll show you what's actually available right now.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                {CITIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setCity(c); setStep(2); }}
                    className={`text-sm font-semibold px-4 py-3 rounded-xl border-2 transition ${
                      city === c ? 'border-amber-500 bg-amber-50 text-gray-900' : 'border-gray-100 text-gray-600 hover:border-gray-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(0)} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
            </StepShell>
          )}

          {step === 1 && path === 'LIST' && (
            <StepShell key="s1l">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2">Almost there</p>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-2">What kind of car?</h1>
              <p className="text-gray-500 text-sm mb-6">Just so we can show you a realistic earnings estimate.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => { setCategory(c.label); setStep(2); }}
                    className={`text-sm font-semibold px-4 py-4 rounded-xl border-2 transition flex flex-col items-center gap-1.5 ${
                      category === c.label ? 'border-amber-500 bg-amber-50 text-gray-900' : 'border-gray-100 text-gray-600 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-xl">{c.icon}</span>
                    {c.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(0)} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
            </StepShell>
          )}

          {step === 2 && path === 'RENT' && (
            <StepShell key="s2r">
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">Here's what's waiting for you</p>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-6">
                {pulseLoading ? 'Checking…' : pulse && pulse.availableCount > 0
                  ? `${pulse.availableCount} car${pulse.availableCount === 1 ? '' : 's'} ready to book in ${city}`
                  : `${city} is coming soon`}
              </h1>
              {pulse && pulse.averageDailyRate && (
                <p className="text-gray-500 text-sm mb-6">Averaging around <b className="text-gray-900">₹{pulse.averageDailyRate.toLocaleString()}/day</b>.</p>
              )}
              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-3">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <p className="text-sm text-gray-700">Every host is KYC-verified (Aadhaar OTP or Arya.ai) — no exceptions.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <p className="text-sm text-gray-700">Your security deposit is held, not charged — refunded after the trip.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <p className="text-sm text-gray-700">See the full price upfront — no surprise fees at pickup.</p>
                </div>
              </div>
              <MotionButton
                onClick={browseWithDefaults}
                className="w-full btn-gradient text-white font-bold py-4 rounded-xl transition text-center block"
              >
                See available cars →
              </MotionButton>
              <p className="text-center text-xs text-gray-400 mt-4">No account needed to browse — you'll only sign up when you're ready to book.</p>
            </StepShell>
          )}

          {step === 2 && path === 'LIST' && (
            <StepShell key="s2l">
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">Here's what listing looks like</p>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Your {category.toLowerCase()} could be earning within days</h1>
              <div className="space-y-3 mb-8">
                <div className="flex items-start gap-3">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <p className="text-sm text-gray-700">Keep 70% of every booking — no hidden platform cuts.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <p className="text-sm text-gray-700">Guaranteed payouts via our N+1 policy for managed fleets.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <p className="text-sm text-gray-700">You set the price, availability, and delivery terms.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <MotionButton
                  href="/host/earnings-calculator"
                  className="flex-1 border-2 border-amber-500 text-amber-600 font-bold py-4 rounded-xl transition text-center block"
                >
                  Calculate my earnings
                </MotionButton>
                <MotionButton
                  href="/host/onboarding"
                  className="flex-1 btn-gradient text-white font-bold py-4 rounded-xl transition text-center block"
                >
                  Start listing →
                </MotionButton>
              </div>
            </StepShell>
          )}
        </AnimatePresence>
      </div>
      <Footer />
    </div>
  );
}
