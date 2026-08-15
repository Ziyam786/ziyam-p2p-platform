'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import CarOnboardingWizard, { wizardValuesToPayload, type WizardValues } from '../../../components/CarOnboardingWizard';
import { useAuth } from '../../../lib/auth-context';
import { useToast } from '../../../components/Toast';
import { kycApi, hostApi } from '../../../lib/api';

const STEPS = ['Create account', 'Verify KYC', 'List your first car', 'Done'];

export default function HostOnboardingPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const { show } = useToast();

  const [docUrl, setDocUrl] = useState('');
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [carSubmitting, setCarSubmitting] = useState(false);
  const [hasCar, setHasCar] = useState(false);
  const [checkingCars, setCheckingCars] = useState(true);

  useEffect(() => {
    if (!user || !(user.role === 'SELF_HOST' || user.role === 'FLEET_OPERATOR')) {
      setCheckingCars(false);
      return;
    }
    hostApi.myCars(user.id).then((res) => setHasCar(res.data.length > 0)).finally(() => setCheckingCars(false));
  }, [user]);

  const currentStep = !user ? 0 : !user.isKycVerified ? 1 : !hasCar ? 2 : 3;

  async function submitKyc(e: React.FormEvent) {
    e.preventDefault();
    setKycSubmitting(true);
    try {
      await kycApi.submit(docUrl);
      await refresh();
      show('KYC verified!', 'success');
    } catch (err: any) {
      show(err.message ?? 'KYC failed', 'error');
    } finally {
      setKycSubmitting(false);
    }
  }

  async function submitCar(values: WizardValues) {
    if (!user) return;
    setCarSubmitting(true);
    try {
      await hostApi.addCar(user.id, wizardValuesToPayload(values));
      setHasCar(true);
      show('Your first car is live!', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to list car', 'error');
    } finally {
      setCarSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-24">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Become a Ziyam Host</h1>
        <p className="text-gray-500 text-sm mb-8">List your car in a few minutes and start earning 70% of every booking</p>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    i < currentStep ? 'bg-emerald-500 text-white' : i === currentStep ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span className="text-[10px] text-gray-500 text-center max-w-[70px]">{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < currentStep ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        {loading || checkingCars ? (
          <p className="text-gray-400 text-sm text-center">Loading…</p>
        ) : currentStep === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <span className="text-4xl block mb-3">🔑</span>
            <p className="font-bold text-gray-900 mb-2">Create a host account to get started</p>
            <p className="text-gray-500 text-sm mb-6">Choose "List my car" or "Fleet operator" when signing up.</p>
            <a href="/signup" className="btn-gradient text-white font-bold px-6 py-3 rounded-xl transition text-sm">
              Create Host Account
            </a>
          </div>
        ) : currentStep === 1 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8">
            <p className="font-bold text-gray-900 mb-2">Verify your identity</p>
            <p className="text-gray-500 text-sm mb-6">Required before you can list a vehicle, for renter safety and trust.</p>
            <form onSubmit={submitKyc} className="space-y-4">
              <input
                required
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://digilocker.gov.in/documents/..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button type="submit" disabled={kycSubmitting} className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition">
                {kycSubmitting ? 'Verifying…' : 'Verify Instantly'}
              </button>
            </form>
          </div>
        ) : currentStep === 2 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <CarOnboardingWizard submitting={carSubmitting} onSubmit={submitCar} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <span className="text-4xl block mb-3">🎉</span>
            <p className="font-bold text-gray-900 mb-2">You're all set!</p>
            <p className="text-gray-500 text-sm mb-6">Your car is live. Manage bookings and earnings from your dashboard.</p>
            <button onClick={() => router.push('/host/dashboard')} className="btn-gradient text-white font-bold px-6 py-3 rounded-xl transition text-sm">
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
