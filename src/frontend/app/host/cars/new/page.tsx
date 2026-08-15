'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import Footer from '../../../../components/Footer';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import CarOnboardingWizard, { wizardValuesToPayload, type WizardValues } from '../../../../components/CarOnboardingWizard';
import { useAuth } from '../../../../lib/auth-context';
import { useToast } from '../../../../components/Toast';
import { hostApi } from '../../../../lib/api';

function NewCarInner() {
  const { user } = useAuth();
  const router = useRouter();
  const { show } = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  if (!user.isKycVerified) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-32 pb-24 text-center">
        <span className="text-4xl block mb-3">🪪</span>
        <p className="text-gray-700 font-semibold mb-2">Complete KYC first</p>
        <p className="text-gray-500 text-sm mb-6">You need to verify your identity before listing a car.</p>
        <a href="/account/kyc" className="text-amber-500 underline font-semibold">Verify now</a>
      </div>
    );
  }

  async function handleSubmit(values: WizardValues) {
    setSubmitting(true);
    try {
      await hostApi.addCar(user!.id, wizardValuesToPayload(values));
      show('Car onboarded successfully!', 'success');
      router.push('/host/dashboard');
    } catch (err: any) {
      show(err.message ?? 'Failed to list car', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-28 pb-24">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Onboard Your Car</h1>
      <p className="text-gray-500 text-sm mb-8">A few quick steps to get your car earning</p>
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <CarOnboardingWizard submitting={submitting} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}

export default function NewCarPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <ProtectedRoute roles={['SELF_HOST', 'FLEET_OPERATOR']}>
        <NewCarInner />
      </ProtectedRoute>
      <Footer />
    </div>
  );
}
