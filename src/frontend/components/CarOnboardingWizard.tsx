'use client';

import React, { useEffect, useState } from 'react';
import FeaturePicker from './FeaturePicker';
import AddressAutocomplete from './AddressAutocomplete';
import { settingsApi } from '../lib/api';

const CATEGORIES_FALLBACK = ['Hatchback', 'Sedan', 'SUV', 'Luxury', 'EV', 'MUV'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'CNG'];
const TRANSMISSIONS = ['Manual', 'Automatic'];
const CITIES_FALLBACK = ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Jaipur', 'Ahmedabad', 'Kochi'];
const PHOTO_SLOTS = ['Front View', 'Left View', 'Right View', 'Rear View', 'Interior / Dashboard'];

export interface WizardValues {
  registrationNo: string; make: string; model: string; year: number; category: string;
  fuelType: string; transmission: string; seats: number; city: string;
  address: string; latitude: number | null; longitude: number | null;
  rcDocUrl: string; pollutionCertUrl: string; insuranceDocUrl: string;
  images: string[]; description: string; features: string[];
  dailyRate: number; securityDeposit: number; kmIncludedPerDay: number; extraKmCharge: number;
  instantBook: boolean; offersDelivery: boolean; deliveryFee: number; offersPickup: boolean; pickupFee: number;
}

const DEFAULTS: WizardValues = {
  registrationNo: '', make: '', model: '', year: new Date().getFullYear(), category: 'Hatchback',
  fuelType: 'Petrol', transmission: 'Manual', seats: 5, city: 'Bengaluru',
  address: '', latitude: null, longitude: null,
  rcDocUrl: '', pollutionCertUrl: '', insuranceDocUrl: '',
  images: ['', '', '', '', ''], description: '', features: ['Air Conditioning', 'Power Steering', 'Bluetooth', 'Power Windows', 'Music System'],
  dailyRate: 1200, securityDeposit: 3000, kmIncludedPerDay: 300, extraKmCharge: 10,
  instantBook: true, offersDelivery: false, deliveryFee: 0, offersPickup: false, pickupFee: 0,
};

export function wizardValuesToPayload(v: WizardValues) {
  return {
    make: v.make, model: v.model, registrationNo: v.registrationNo, year: Number(v.year), category: v.category,
    fuelType: v.fuelType, transmission: v.transmission, seats: Number(v.seats), dailyRate: Number(v.dailyRate),
    securityDeposit: Number(v.securityDeposit), kmIncludedPerDay: Number(v.kmIncludedPerDay),
    extraKmCharge: Number(v.extraKmCharge), city: v.city, description: v.description,
    address: v.address || undefined, latitude: v.latitude ?? undefined, longitude: v.longitude ?? undefined,
    images: v.images.map((s) => s.trim()).filter(Boolean),
    features: v.features,
    instantBook: v.instantBook, offersDelivery: v.offersDelivery, deliveryFee: Number(v.deliveryFee),
    offersPickup: v.offersPickup, pickupFee: Number(v.pickupFee),
    rcDocUrl: v.rcDocUrl || undefined, pollutionCertUrl: v.pollutionCertUrl || undefined, insuranceDocUrl: v.insuranceDocUrl || undefined,
    onboardingStep: 4,
  };
}

const STEPS = ['Vehicle', 'Documents', 'Photos', 'Features & Pricing', 'Review'];

export default function CarOnboardingWizard({
  submitting,
  onSubmit,
}: {
  submitting: boolean;
  onSubmit: (values: WizardValues) => void;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<WizardValues>(DEFAULTS);
  const [categories, setCategories] = useState<string[]>(CATEGORIES_FALLBACK);
  const [cities, setCities] = useState<string[]>(CITIES_FALLBACK);

  useEffect(() => {
    settingsApi
      .public()
      .then((res) => {
        if (res.data.categories?.length) setCategories(res.data.categories.map((c) => c.label));
        if (res.data.cities?.length) setCities(res.data.cities.map((c) => c.name));
      })
      .catch(() => {});
  }, []);

  function set<K extends keyof WizardValues>(key: K, value: WizardValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const stepValid =
    step === 0 ? Boolean(values.registrationNo && values.make && values.model)
    : step === 1 ? true // documents are optional to proceed, but drive the verified badge
    : step === 2 ? true
    : step === 3 ? values.features.length >= 5 && Number(values.dailyRate) > 0
    : true;

  const docsComplete = Boolean(values.rcDocUrl && values.pollutionCertUrl && values.insuranceDocUrl);
  const photosCount = values.images.filter((s) => s.trim()).length;
  const stepsCompleted = [
    Boolean(values.registrationNo && values.make && values.model),
    docsComplete,
    photosCount >= 2,
    values.features.length >= 5,
  ].filter(Boolean).length;

  return (
    <div>
      {/* Progress ring + step chips */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="relative w-12 h-12">
            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
              <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="4" />
              <circle
                cx="18" cy="18" r="16" fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(stepsCompleted / 4) * 100.5} 100.5`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">{stepsCompleted}/4</span>
          </div>
          <div className="text-xs text-gray-500">
            <p className="font-semibold text-gray-700">Onboarding progress</p>
            <p>Steps completed</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-amber-600 bg-amber-50 rounded-full px-3 py-1">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </span>
      </div>

      <div className="flex gap-1.5 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-amber-400' : 'bg-gray-200'}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">Enter your vehicle number to get started onboarding your car to earn more.</p>
          <Field label="Vehicle Registration Number">
            <input required value={values.registrationNo} onChange={(e) => set('registrationNo', e.target.value.toUpperCase())} className={inputCls} placeholder="KA01AB1234" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Make"><input required value={values.make} onChange={(e) => set('make', e.target.value)} className={inputCls} placeholder="Maruti" /></Field>
            <Field label="Model"><input required value={values.model} onChange={(e) => set('model', e.target.value)} className={inputCls} placeholder="Swift" /></Field>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Year"><input type="number" min={2000} max={new Date().getFullYear() + 1} value={values.year} onChange={(e) => set('year', Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Category">
              <select value={values.category} onChange={(e) => set('category', e.target.value)} className={inputCls}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Fuel Type">
              <select value={values.fuelType} onChange={(e) => set('fuelType', e.target.value)} className={inputCls}>
                {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Transmission">
              <select value={values.transmission} onChange={(e) => set('transmission', e.target.value)} className={inputCls}>
                {TRANSMISSIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Seats"><input type="number" min={2} max={10} value={values.seats} onChange={(e) => set('seats', Number(e.target.value))} className={inputCls} /></Field>
            <Field label="City">
              <select value={values.city} onChange={(e) => set('city', e.target.value)} className={inputCls}>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Exact Location">
            <AddressAutocomplete
              value={values.address}
              onChange={(address) => set('address', address)}
              onSelect={(sel) => {
                set('address', sel.address);
                set('latitude', sel.latitude);
                set('longitude', sel.longitude);
              }}
              placeholder="Search for the car's pickup address…"
            />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
            We require your car's documents to verify your listing and prefill the necessary data. Paste a link to a
            scanned copy or photo of each document — we'll store them against this listing.
          </div>
          <Field label="Registration Certificate (RC)">
            <input value={values.rcDocUrl} onChange={(e) => set('rcDocUrl', e.target.value)} className={inputCls} placeholder="https://... (RC front & back)" />
          </Field>
          <Field label="Pollution Certificate (PUC)">
            <input value={values.pollutionCertUrl} onChange={(e) => set('pollutionCertUrl', e.target.value)} className={inputCls} placeholder="https://..." />
          </Field>
          <Field label="Insurance Document">
            <input value={values.insuranceDocUrl} onChange={(e) => set('insuranceDocUrl', e.target.value)} className={inputCls} placeholder="https://..." />
          </Field>
          {docsComplete ? (
            <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">✓ All three documents provided — this car will show as Verified.</p>
          ) : (
            <p className="text-xs text-gray-400">You can skip this for now and add documents later from "Manage your car", but verified listings get more bookings.</p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">Add clear, well-lit photos from each angle. Paste image URLs for now.</p>
          {PHOTO_SLOTS.map((slot, i) => (
            <Field key={slot} label={slot}>
              <input
                value={values.images[i]}
                onChange={(e) => {
                  const next = [...values.images];
                  next[i] = e.target.value;
                  set('images', next);
                }}
                className={inputCls}
                placeholder="https://..."
              />
            </Field>
          ))}
          <p className="text-xs text-gray-400">{photosCount} of {PHOTO_SLOTS.length} photo slots filled · at least 2 recommended</p>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <FeaturePicker selected={values.features} onChange={(next) => set('features', next)} />
          <Field label="Description">
            <textarea value={values.description} onChange={(e) => set('description', e.target.value)} rows={3} className={inputCls} placeholder="Car is well maintained..." />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Daily Rate (₹)"><input required type="number" min={0} value={values.dailyRate} onChange={(e) => set('dailyRate', Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Security Deposit (₹)"><input type="number" min={0} value={values.securityDeposit} onChange={(e) => set('securityDeposit', Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Km Included/Day"><input type="number" min={0} value={values.kmIncludedPerDay} onChange={(e) => set('kmIncludedPerDay', Number(e.target.value))} className={inputCls} /></Field>
            <Field label="Extra Km Charge (₹)"><input type="number" min={0} value={values.extraKmCharge} onChange={(e) => set('extraKmCharge', Number(e.target.value))} className={inputCls} /></Field>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={values.instantBook} onChange={(e) => set('instantBook', e.target.checked)} className="w-4 h-4 accent-amber-500" />
              <span className="text-sm text-gray-700">Allow Instant Book (skip host approval)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={values.offersPickup} onChange={(e) => set('offersPickup', e.target.checked)} className="w-4 h-4 accent-amber-500" />
              <span className="text-sm text-gray-700">Offer to pick up the car from the guest at drop-off</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={values.offersDelivery} onChange={(e) => set('offersDelivery', e.target.checked)} className="w-4 h-4 accent-amber-500" />
              <span className="text-sm text-gray-700">Offer doorstep delivery to the guest</span>
            </label>
            {(values.offersDelivery || values.offersPickup) && (
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                {values.offersDelivery && <Field label="Delivery Fee (₹)"><input type="number" min={0} value={values.deliveryFee} onChange={(e) => set('deliveryFee', Number(e.target.value))} className={inputCls} /></Field>}
                {values.offersPickup && <Field label="Pickup Fee (₹)"><input type="number" min={0} value={values.pickupFee} onChange={(e) => set('pickupFee', Number(e.target.value))} className={inputCls} /></Field>}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-5 text-center">
            <div className="relative w-20 h-20 mx-auto mb-3">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(stepsCompleted / 4) * 100.5} 100.5`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-extrabold text-gray-800">{stepsCompleted}/4</span>
            </div>
            <p className="font-bold text-gray-900">Steps Completed</p>
            <p className="text-sm text-gray-500 mt-1">It should take you only a few minutes to complete the onboarding journey.</p>
          </div>
          <div className="rounded-xl border border-gray-100 divide-y">
            <ReviewRow label="Vehicle" value={`${values.make} ${values.model} (${values.year}) · ${values.registrationNo}`} />
            <ReviewRow label="Documents" value={docsComplete ? 'All 3 uploaded — will show Verified' : 'Incomplete — add later to get verified'} ok={docsComplete} />
            <ReviewRow label="Photos" value={`${photosCount} of ${PHOTO_SLOTS.length} slots filled`} ok={photosCount >= 2} />
            <ReviewRow label="Features" value={`${values.features.length} selected`} ok={values.features.length >= 5} />
            <ReviewRow label="Pricing" value={`₹${values.dailyRate}/day · ${values.city}`} ok />
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl transition hover:border-gray-300">
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!stepValid}
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={() => onSubmit(values)}
            className="flex-1 btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
          >
            {submitting ? 'Listing…' : 'Onboard Your Car'}
          </button>
        )}
      </div>
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium text-right ${ok === false ? 'text-amber-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}
