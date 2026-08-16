'use client';

import React, { useMemo, useState } from 'react';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import PageHero from '../../../components/PageHero';

const HOST_SHARE = 0.7;

export default function EarningsCalculatorPage() {
  const [dailyRate, setDailyRate] = useState(1800);
  const [utilization, setUtilization] = useState(60);

  const { monthlyGross, monthlyNet, yearlyNet, daysBooked } = useMemo(() => {
    const daysBooked = Math.round((utilization / 100) * 30);
    const monthlyGross = daysBooked * dailyRate;
    const monthlyNet = Math.round(monthlyGross * HOST_SHARE);
    return { monthlyGross, monthlyNet, yearlyNet: monthlyNet * 12, daysBooked };
  }, [dailyRate, utilization]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <PageHero eyebrow="For Car Owners" title="Earnings Calculator" subtitle="Estimate how much you could earn hosting your car on ZiyamSelfDrive." />

      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-8">
            <div className="space-y-8 mb-8">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Your daily rate</label>
                  <span className="text-amber-500 font-bold">₹{dailyRate.toLocaleString()}/day</span>
                </div>
                <input
                  type="range" min={800} max={9000} step={100}
                  value={dailyRate} onChange={(e) => setDailyRate(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Expected utilization</label>
                  <span className="text-amber-500 font-bold">{utilization}% of days booked</span>
                </div>
                <input
                  type="range" min={10} max={100} step={5}
                  value={utilization} onChange={(e) => setUtilization(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Days Booked / Month</p>
                <p className="text-2xl font-extrabold text-gray-900">{daysBooked}</p>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Your Monthly Earnings (70%)</p>
                <p className="text-2xl font-extrabold text-emerald-600">₹{monthlyNet.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-100 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Estimated Yearly</p>
                <p className="text-2xl font-extrabold text-gray-900">₹{yearlyNet.toLocaleString()}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center mt-6">
              Gross monthly revenue: ₹{monthlyGross.toLocaleString()} · You keep 70%, Ziyam retains 30% for
              marketing, guest verification, and platform operations.
            </p>
          </div>

          <div className="text-center mt-10">
            <a href="/host/onboarding" className="btn-gradient text-white font-bold px-8 py-4 rounded-xl inline-block transition">
              Start Listing Your Car
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
