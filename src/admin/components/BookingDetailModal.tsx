'use client';

import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { adminApi } from '../lib/api';
import type { AdminBooking, BookingConditionPhoto, TripStage } from '../lib/types';

const DEPOSIT_STATUS_STYLES: Record<string, string> = {
  HELD: 'bg-amber-500/10 text-amber-300',
  RELEASED: 'bg-emerald-500/10 text-emerald-300',
  PARTIALLY_DEDUCTED: 'bg-orange-500/10 text-orange-300',
  FORFEITED: 'bg-red-500/10 text-red-300',
};

export default function BookingDetailModal({ booking, onClose }: { booking: AdminBooking | null; onClose: () => void }) {
  const [photos, setPhotos] = useState<BookingConditionPhoto[]>([]);
  const [tab, setTab] = useState<TripStage>('PRE_TRIP');
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  useEffect(() => {
    if (!booking) return;
    setLoadingPhotos(true);
    adminApi
      .bookingConditionPhotos(booking.id)
      .then((res) => setPhotos(res.data))
      .finally(() => setLoadingPhotos(false));
  }, [booking?.id]);

  const refund = booking?.refundRequests?.[0];
  const tabPhotos = photos.filter((p) => p.stage === tab);

  return (
    <Modal open={Boolean(booking)} onClose={onClose} title={booking ? `${booking.car?.make} ${booking.car?.model} — ${booking.status}` : 'Booking'}>
      {booking && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Customer</p>
              {booking.source === 'AXON_PARTNER' ? (
                <p className="text-slate-200 flex items-center gap-1.5">
                  <span className="bg-sky-500/10 text-sky-300 text-[10px] font-bold px-2 py-0.5 rounded-full">AXON</span>
                  {booking.axonPartner?.companyName ?? 'Partner'}
                </p>
              ) : (
                <p className="text-slate-200">{booking.customer?.fullName ?? '—'}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Dates</p>
              <p className="text-slate-200">{new Date(booking.startTime).toLocaleDateString()} → {new Date(booking.endTime).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Amount</p>
              <p className="text-slate-200">₹{booking.totalAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Deposit</p>
              <p className="text-slate-200">
                ₹{booking.depositAmount.toLocaleString()}{' '}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${DEPOSIT_STATUS_STYLES[booking.depositStatus] ?? 'bg-slate-800 text-slate-400'}`}>
                  {booking.depositStatus.replace(/_/g, ' ')}
                </span>
              </p>
            </div>
          </div>

          {booking.lateFeeAmount > 0 && (
            <div className="bg-orange-500/10 text-orange-300 rounded-lg px-4 py-3 text-sm">
              ₹{booking.lateFeeAmount.toLocaleString()} late-return fee ({Math.round(booking.lateFeeHours)}h late) — deducted from the released deposit
            </div>
          )}

          {booking.status === 'RESERVED' && booking.reservationDeadline && (
            <div className="bg-amber-500/10 text-amber-300 rounded-lg px-4 py-3 text-sm">
              ₹{booking.reservationFeeAmount.toLocaleString()} reservation fee paid — balance due by {new Date(booking.reservationDeadline).toLocaleString()}
            </div>
          )}

          {booking.status === 'PENDING_HOST_REVIEW' && booking.hostReviewDeadline && (
            <div className="bg-amber-500/10 text-amber-300 rounded-lg px-4 py-3 text-sm">
              Awaiting host response by {new Date(booking.hostReviewDeadline).toLocaleString()}
            </div>
          )}

          {booking.status === 'REJECTED' && (
            <div className="bg-red-500/10 rounded-lg px-4 py-3 text-sm">
              <p className="text-red-300 font-semibold mb-1">Rejected by host {booking.cancelledBy === 'SYSTEM' ? '(review-window timeout)' : ''}</p>
              <p className="text-slate-300">{booking.rejectionReason ?? '—'}</p>
            </div>
          )}

          {booking.status === 'CANCELLED' && booking.cancellationReason && (
            <div className="bg-red-500/10 rounded-lg px-4 py-3 text-sm">
              <p className="text-red-300 font-semibold mb-1">Cancelled by {booking.cancelledBy?.toLowerCase() ?? 'guest'}</p>
              <p className="text-slate-300">{booking.cancellationReason}</p>
            </div>
          )}

          {refund && (
            <div className="bg-slate-800/60 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
              <div>
                <p className="text-slate-200 font-semibold">₹{refund.amount.toLocaleString()} refund — {refund.type.replace(/_/g, ' ').toLowerCase()}</p>
                <p className="text-xs text-slate-500">Requested {new Date(refund.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${refund.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                {refund.status}
              </span>
            </div>
          )}

          <div>
            <div className="flex gap-2 mb-3">
              {(['PRE_TRIP', 'POST_TRIP'] as const).map((stage) => (
                <button
                  key={stage}
                  onClick={() => setTab(stage)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${tab === stage ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                >
                  {stage === 'PRE_TRIP' ? 'Pickup' : 'Drop-off'}
                </button>
              ))}
            </div>
            {loadingPhotos ? (
              <p className="text-xs text-slate-500">Loading photos…</p>
            ) : tabPhotos.length === 0 ? (
              <p className="text-xs text-slate-500">No {tab === 'PRE_TRIP' ? 'pickup' : 'drop-off'} photos uploaded.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {tabPhotos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.id} src={p.url} alt={p.angle} title={p.angle.replace(/_/g, ' ')} className="w-full aspect-square object-cover rounded-lg border border-slate-800" />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
