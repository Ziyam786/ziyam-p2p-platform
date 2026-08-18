'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import Footer from '../../../components/Footer';
import { itinerariesApi } from '../../../lib/api';
import type { ItineraryUnlock } from '../../../lib/api';
import { generateRoadTripItinerary } from '../../../lib/firebase';

function needsFirebaseFill(unlock: ItineraryUnlock): boolean {
  if (unlock.status !== 'PAID') return false;
  const text = unlock.generatedContent?.trim() ?? '';
  return text.length < 80 || /couldn't generate your itinerary/i.test(text);
}

export default function ItineraryPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [unlock, setUnlock] = useState<ItineraryUnlock | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const generateStarted = useRef(false);

  useEffect(() => {
    let active = true;
    let attempts = 0;

    function poll() {
      attempts += 1;
      itinerariesApi
        .get(params.id)
        .then((res) => {
          if (!active) return;
          setUnlock(res.data);
          if (res.data.status === 'PENDING_PAYMENT' && attempts < 8) {
            setTimeout(poll, 1500);
          } else {
            setLoading(false);
          }
        })
        .catch(() => active && (setNotFound(true), setLoading(false)));
    }
    poll();
    return () => {
      active = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (!unlock || loading || !needsFirebaseFill(unlock) || generateStarted.current) return;
    generateStarted.current = true;
    let cancelled = false;
    setGenerating(true);
    setGenerateError(null);
    generateRoadTripItinerary(unlock.destination)
      .then((text) => itinerariesApi.saveContent(unlock.id, text))
      .then((res) => {
        if (!cancelled) setUnlock(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setGenerateError(err instanceof Error ? err.message : 'Could not generate the itinerary');
        }
      })
      .finally(() => {
        if (!cancelled) setGenerating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unlock, loading]);

  const paymentIssue = searchParams.get('payment');

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-24">
        {loading ? (
          <p className="text-center text-gray-400 py-20">
            {unlock?.status === 'PENDING_PAYMENT' ? 'Confirming your payment…' : 'Loading…'}
          </p>
        ) : notFound ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">We couldn't find that itinerary.</p>
            <a href="/" className="text-amber-500 underline font-semibold">Back to home</a>
          </div>
        ) : !unlock ? null : unlock.status === 'FAILED' || paymentIssue === 'failed' ? (
          <div className="text-center py-20">
            <p className="text-gray-700 font-semibold mb-2">Payment didn't go through</p>
            <p className="text-gray-500 text-sm mb-4">You haven't been charged. Try unlocking again from the homepage.</p>
            <a href="/#itineraries" className="text-amber-500 underline font-semibold">Back to itineraries</a>
          </div>
        ) : paymentIssue === 'unverified' ? (
          <div className="text-center py-20">
            <p className="text-gray-700 font-semibold mb-2">We couldn't verify that payment</p>
            <p className="text-gray-500 text-sm mb-4">If you were charged, contact support and we'll sort it out — no charge should be lost.</p>
          </div>
        ) : unlock.status === 'PENDING_PAYMENT' ? (
          <div className="text-center py-20">
            <p className="text-gray-700 font-semibold mb-2">Still confirming your payment…</p>
            <p className="text-gray-500 text-sm">This page will update automatically — hang tight.</p>
          </div>
        ) : generating || needsFirebaseFill(unlock) ? (
          <div className="text-center py-20">
            <p className="text-gray-700 font-semibold mb-2">Writing your itinerary…</p>
            <p className="text-gray-500 text-sm">Payment is confirmed. Gemini is drafting the day-by-day plan now.</p>
            {generateError && <p className="text-red-500 text-sm mt-4">{generateError}</p>}
          </div>
        ) : (
          <>
            <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-2">Your Itinerary</p>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Bengaluru → {unlock.destination}</h1>
            <p className="text-gray-500 text-sm mb-8">Generated for {unlock.customerName} · Paid ₹{unlock.amount}</p>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 whitespace-pre-line text-sm text-gray-700 leading-relaxed">
              {unlock.generatedContent}
            </div>
            <p className="text-xs text-gray-400 mt-6 text-center">
              Bookmark this page to come back to your itinerary anytime. Safe travels!
            </p>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
