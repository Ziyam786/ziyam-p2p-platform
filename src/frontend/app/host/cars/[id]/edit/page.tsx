'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../../components/Navbar';
import Footer from '../../../../../components/Footer';
import ProtectedRoute from '../../../../../components/ProtectedRoute';
import CarForm, { carToFormValues, formValuesToPayload, type CarFormValues } from '../../../../../components/CarForm';
import { useAuth } from '../../../../../lib/auth-context';
import { useToast } from '../../../../../components/Toast';
import { carsApi } from '../../../../../lib/api';
import type { Car } from '../../../../../lib/types';

function EditCarInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { show } = useToast();

  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rcChecking, setRcChecking] = useState(false);

  useEffect(() => {
    carsApi.get(params.id).then((res) => setCar(res.data)).finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <p className="text-center pt-32 text-gray-400">Loading…</p>;
  if (!car) return <p className="text-center pt-32 text-gray-400">Car not found.</p>;
  if (user && car.ownerId !== user.id) {
    return <p className="text-center pt-32 text-gray-400">You don't have access to edit this listing.</p>;
  }

  async function handleVerifyRc() {
    setRcChecking(true);
    try {
      const res = await carsApi.verifyRc(params.id);
      setCar((c) => (c ? { ...c, rcAutoVerifiedAt: res.data.verifiedAt, rcNumberMatches: res.data.rcNumberMatches } : c));
      show(
        res.data.rcNumberMatches
          ? 'RC number matches your uploaded document'
          : `Extracted RC number (${res.data.extractedRcNo ?? 'not found'}) doesn't match what you entered — double-check both.`,
        res.data.rcNumberMatches ? 'success' : 'error'
      );
    } catch (err: any) {
      show(err.message ?? 'Could not run automated RC check', 'error');
    } finally {
      setRcChecking(false);
    }
  }

  async function handleSubmit(values: CarFormValues) {
    setSubmitting(true);
    try {
      await carsApi.update(params.id, formValuesToPayload(values));
      show('Listing updated', 'success');
      router.push('/host/dashboard');
    } catch (err: any) {
      show(err.message ?? 'Failed to update listing', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-28 pb-24">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Edit Listing</h1>
      <p className="text-gray-500 text-sm mb-6">{car.make} {car.model} · {car.registrationNo}</p>

      {car.rcDocUrl && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Automated RC Check</p>
            <p className="text-xs text-gray-500">
              {car.rcAutoVerifiedAt
                ? car.rcNumberMatches
                  ? '✓ Extracted RC number matches your listing'
                  : '✗ Extracted RC number did not match — re-check your registration number and document'
                : "Not run yet — checks the uploaded RC document's number against what you entered"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleVerifyRc}
            disabled={rcChecking}
            className="shrink-0 text-xs font-semibold border-2 border-gray-900 text-gray-900 px-4 py-2 rounded-xl transition hover:bg-gray-900 hover:text-white disabled:opacity-50"
          >
            {rcChecking ? 'Checking…' : car.rcAutoVerifiedAt ? 'Re-check' : 'Run Check'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <CarForm initial={carToFormValues(car)} submitLabel="Save Changes" submitting={submitting} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}

export default function EditCarPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <ProtectedRoute roles={['SELF_HOST', 'FLEET_OPERATOR']}>
        <EditCarInner />
      </ProtectedRoute>
      <Footer />
    </div>
  );
}
