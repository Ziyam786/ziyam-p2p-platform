'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import { useToast } from './Toast';
import { itinerariesApi, paymentsApi, ApiError } from '../lib/api';
import { openRazorpayCheckout } from '../lib/razorpayCheckout';

export default function ItineraryUnlockModal({ destination, onClose }: { destination: string | null; onClose: () => void }) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!destination) return;
    setSubmitting(true);
    try {
      const res = await itinerariesApi.unlock({
        destination,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
      });
      const result = await openRazorpayCheckout(res.data, {
        name: 'Ziyam SelfDrive',
        description: `${destination} road-trip itinerary`,
        prefillEmail: email.trim(),
        prefillContact: phone.trim(),
      });
      const verified = await paymentsApi.verifyRazorpay({
        razorpay_order_id: result.orderId,
        razorpay_payment_id: result.paymentId,
        razorpay_signature: result.signature,
      });
      onClose();
      router.push(`/itineraries/${verified.entityId}`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not start payment', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={Boolean(destination)} onClose={() => { if (!submitting) onClose(); }} title={`Unlock: Bengaluru → ${destination}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          ₹49 unlocks an AI-generated day-by-day itinerary for this route — stops, timing, attractions, and self-drive tips, ready right after payment.
        </p>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Mobile Number</label>
          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <button type="submit" disabled={submitting} className="w-full btn-gradient text-white font-bold py-3 rounded-xl transition disabled:opacity-60">
          {submitting ? 'Processing…' : 'Pay ₹49 & Unlock'}
        </button>
        <p className="text-[11px] text-gray-400 text-center">🔒 Secure checkout via Razorpay. No account needed.</p>
      </form>
    </Modal>
  );
}
