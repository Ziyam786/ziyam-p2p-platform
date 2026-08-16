'use client';

import React, { useEffect, useState } from 'react';
import { carsApi, ApiError, type FleetOnboardingStatus } from '../lib/api';
import { useToast } from './Toast';
import type { Car } from '../lib/types';

const STEPS = ['Audit', 'Security', 'Agreement', 'Go Live'];

const ELIGIBILITY_CHECKLIST = [
  'Under 6 years old from date of manufacture, with under 50,000 km on the odometer',
  'Roadworthy, mechanically sound, and hygiene-compliant',
  'Valid RC, active comprehensive insurance, and valid PUC certificate on file',
];

export default function FleetOnboardingPanel({ car }: { car: Car }) {
  const { show } = useToast();
  const [status, setStatus] = useState<FleetOnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<boolean[]>(ELIGIBILITY_CHECKLIST.map(() => false));
  const [imei, setImei] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    carsApi.fleetOnboardingStatus(car.id).then((res) => setStatus(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [car.id]);

  async function submitAudit() {
    if (!checked.every(Boolean)) return show('Confirm all eligibility items to proceed', 'error');
    setSubmitting(true);
    try {
      await carsApi.submitFleetAudit(car.id);
      show('Audit submitted — a fleet operator has been assigned', 'success');
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to submit audit', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSecurity(e: React.FormEvent) {
    e.preventDefault();
    if (!imei.trim()) return show('Enter the installed telematics device IMEI', 'error');
    setSubmitting(true);
    try {
      await carsApi.submitFleetSecurity(car.id, imei.trim());
      show('Security step confirmed', 'success');
      load();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Failed to confirm security step', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !status) return <p className="text-gray-400 text-sm text-center py-8">Loading…</p>;

  const step = status.fleetManaged ? 3 : status.fleetOnboardingStep;

  return (
    <div>
      <p className="text-sm text-gray-500 mb-6">
        Opt this car into fleet management — a Ziyam fleet operator handles guest handovers, cleaning, and
        day-to-day logistics for you. See the full{' '}
        <a href="/host/policy" className="text-amber-500 underline">Host Policy</a> for details.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-[10px] text-gray-500 text-center max-w-[70px]">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {status.fleetManaged ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
          <span className="text-4xl block mb-3">🎉</span>
          <p className="font-bold text-gray-900 mb-1">This car is fleet-managed and live</p>
          {status.fleetOperator && (
            <p className="text-sm text-gray-600">Managed by {status.fleetOperator.fullName} · {status.fleetOperator.phoneNumber}</p>
          )}
        </div>
      ) : step === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <p className="font-bold text-gray-900 mb-3">Step 1 — Audit: confirm eligibility</p>
          <div className="space-y-3 mb-6">
            {ELIGIBILITY_CHECKLIST.map((item, i) => (
              <label key={item} className="flex items-start gap-2.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={(e) => setChecked((c) => c.map((v, j) => j === i ? e.target.checked : v))}
                  className="w-4 h-4 mt-0.5 accent-amber-500 shrink-0"
                />
                {item}
              </label>
            ))}
          </div>
          <button disabled={submitting} onClick={submitAudit} className="btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold px-6 py-2.5 rounded-xl transition text-sm">
            {submitting ? 'Submitting…' : 'Submit Audit'}
          </button>
        </div>
      ) : step === 1 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <p className="font-bold text-gray-900 mb-1">Step 2 — Security: GPS & immobilizer</p>
          <p className="text-xs text-gray-500 mb-4">
            {status.fleetOperator ? `${status.fleetOperator.fullName} (${status.fleetOperator.phoneNumber}) will contact you to install the tracking device.` : 'Your assigned fleet operator will contact you to install the tracking device.'}
            {' '}Once installed, enter the device IMEI below.
          </p>
          <form onSubmit={submitSecurity} className="flex gap-3">
            <input
              value={imei}
              onChange={(e) => setImei(e.target.value)}
              placeholder="Device IMEI"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button disabled={submitting} type="submit" className="btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold px-6 rounded-xl transition text-sm">
              {submitting ? 'Saving…' : 'Confirm'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
          <p className="font-bold text-gray-900 mb-1">Step 3 — Awaiting partnership agreement</p>
          <p className="text-sm text-gray-600">
            {status.fleetOperator
              ? `${status.fleetOperator.fullName} will reach out at ${status.fleetOperator.phoneNumber} to complete the Fleet Partner Agreement with you.`
              : 'Your fleet operator will reach out to complete the Fleet Partner Agreement with you.'}
            {' '}Your car goes live under fleet management as soon as that's signed — no action needed from you right now.
          </p>
        </div>
      )}
    </div>
  );
}
