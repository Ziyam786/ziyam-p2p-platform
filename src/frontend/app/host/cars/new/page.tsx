'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import Footer from '../../../../components/Footer';
import ProtectedRoute from '../../../../components/ProtectedRoute';
import CarForm, { formValuesToPayload, type CarFormValues } from '../../../../components/CarForm';
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

  async function handleSubmit(values: CarFormValues) {
    setSubmitting(true);
    try {
      await hostApi.addCar(user!.id, formValuesToPayload(values));
      show('Car listed successfully!', 'success');
      router.push('/host/dashboard');
    } catch (err: any) {
      show(err.message ?? 'Failed to list car', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-28 pb-24">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">List a New Car</h1>
      <p className="text-gray-500 text-sm mb-8">Add your vehicle's details to start earning</p>
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <CarForm submitLabel="List Car" submitting={submitting} onSubmit={handleSubmit} />
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
