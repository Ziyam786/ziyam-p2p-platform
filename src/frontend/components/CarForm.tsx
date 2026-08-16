'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Car } from '../lib/types';
import { settingsApi } from '../lib/api';
import FeaturePicker from './FeaturePicker';
import AddressAutocomplete from './AddressAutocomplete';
import FileUploadField from './FileUploadField';
import SmartPriceSlider from './SmartPriceSlider';

const CATEGORIES_FALLBACK = ['Hatchback', 'Sedan', 'SUV', 'Luxury', 'EV', 'MUV'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'CNG'];
const TRANSMISSIONS = ['Manual', 'Automatic'];
const CITIES_FALLBACK = ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Jaipur', 'Ahmedabad', 'Kochi'];

export interface CarFormValues {
  make: string; model: string; registrationNo: string; year: number; category: string;
  fuelType: string; transmission: string; seats: number; dailyRate: number; securityDeposit: number;
  kmIncludedPerDay: number; extraKmCharge: number; city: string; address: string;
  latitude: number | null; longitude: number | null; description: string;
  images: string[]; features: string; instantBook: boolean; offersDelivery: boolean; deliveryFee: number;
  offersPickup: boolean; pickupFee: number;
}

const DEFAULTS: CarFormValues = {
  make: '', model: '', registrationNo: '', year: new Date().getFullYear(), category: 'Hatchback',
  fuelType: 'Petrol', transmission: 'Manual', seats: 5, dailyRate: 1200, securityDeposit: 3000,
  kmIncludedPerDay: 300, extraKmCharge: 10, city: 'Bengaluru', address: '', latitude: null, longitude: null, description: '',
  images: [], features: 'Air Conditioning, Bluetooth / Aux, Power Steering', instantBook: true,
  offersDelivery: false, deliveryFee: 0, offersPickup: false, pickupFee: 0,
};

export function carToFormValues(car: Car): CarFormValues {
  return {
    make: car.make, model: car.model, registrationNo: car.registrationNo, year: car.year, category: car.category,
    fuelType: car.fuelType, transmission: car.transmission, seats: car.seats, dailyRate: car.dailyRate,
    securityDeposit: car.securityDeposit, kmIncludedPerDay: car.kmIncludedPerDay, extraKmCharge: car.extraKmCharge,
    city: car.city, address: car.address ?? '', latitude: car.latitude ?? null, longitude: car.longitude ?? null,
    description: car.description ?? '', images: car.images, features: car.features.join(', '),
    instantBook: car.instantBook, offersDelivery: car.offersDelivery, deliveryFee: car.deliveryFee,
    offersPickup: car.offersPickup, pickupFee: car.pickupFee,
  };
}

export function formValuesToPayload(v: CarFormValues) {
  return {
    make: v.make, model: v.model, registrationNo: v.registrationNo, year: Number(v.year), category: v.category,
    fuelType: v.fuelType, transmission: v.transmission, seats: Number(v.seats), dailyRate: Number(v.dailyRate),
    securityDeposit: Number(v.securityDeposit), kmIncludedPerDay: Number(v.kmIncludedPerDay),
    extraKmCharge: Number(v.extraKmCharge), city: v.city, description: v.description,
    address: v.address || undefined, latitude: v.latitude ?? undefined, longitude: v.longitude ?? undefined,
    images: v.images,
    features: v.features.split(',').map((s) => s.trim()).filter(Boolean),
    instantBook: v.instantBook, offersDelivery: v.offersDelivery, deliveryFee: Number(v.deliveryFee),
    offersPickup: v.offersPickup, pickupFee: Number(v.pickupFee),
  };
}

export default function CarForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial?: Partial<CarFormValues>;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: CarFormValues) => void;
}) {
  const [values, setValues] = useState<CarFormValues>({ ...DEFAULTS, ...initial });
  const [categories, setCategories] = useState<string[]>(CATEGORIES_FALLBACK);
  const [cities, setCities] = useState<string[]>(CITIES_FALLBACK);

  useEffect(() => {
    settingsApi
      .public()
      .then((res) => {
        if (res.data.categories?.length) setCategories(res.data.categories.map((c) => c.label));
        if (res.data.cities?.length) setCities(res.data.cities.map((c) => c.name));
      })
      .catch(() => {
        // Keep the hardcoded fallbacks — the form still works without live settings.
      });
  }, []);

  function set<K extends keyof CarFormValues>(key: K, value: CarFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Make">
          <input required value={values.make} onChange={(e) => set('make', e.target.value)} className={inputCls} placeholder="Maruti" />
        </Field>
        <Field label="Model">
          <input required value={values.model} onChange={(e) => set('model', e.target.value)} className={inputCls} placeholder="Swift" />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Registration No.">
          <input required value={values.registrationNo} onChange={(e) => set('registrationNo', e.target.value.toUpperCase())} className={inputCls} placeholder="KA01AB1234" />
        </Field>
        <Field label="Year">
          <input required type="number" min={2000} max={new Date().getFullYear() + 1} value={values.year} onChange={(e) => set('year', Number(e.target.value))} className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
        <Field label="Seats">
          <input type="number" min={2} max={10} value={values.seats} onChange={(e) => set('seats', Number(e.target.value))} className={inputCls} />
        </Field>
      </div>

      <SmartPriceSlider
        category={values.category}
        city={values.city}
        dailyRate={values.dailyRate}
        onChange={(rate) => set('dailyRate', rate)}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Field label="Security Deposit (₹)">
          <input type="number" min={0} value={values.securityDeposit} onChange={(e) => set('securityDeposit', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Km Included/Day">
          <input type="number" min={0} value={values.kmIncludedPerDay} onChange={(e) => set('kmIncludedPerDay', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Extra Km Charge (₹)">
          <input type="number" min={0} value={values.extraKmCharge} onChange={(e) => set('extraKmCharge', Number(e.target.value))} className={inputCls} />
        </Field>
      </div>

      <Field label="City">
        <select required value={values.city} onChange={(e) => set('city', e.target.value)} className={inputCls}>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>

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

      <Field label="Description">
        <textarea value={values.description} onChange={(e) => set('description', e.target.value)} rows={3} className={inputCls} placeholder="A well-maintained car, perfect for city drives..." />
      </Field>

      <Field label="Photos">
        <div className="flex flex-wrap gap-3 mb-3">
          {values.images.map((url, i) => (
            <div key={url + i} className="relative w-20 h-20">
              <Image src={url} alt={`Car photo ${i + 1}`} fill sizes="80px" className="rounded-lg object-cover border border-gray-200" />
              <button
                type="button"
                onClick={() => set('images', values.images.filter((_, j) => j !== i))}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <FileUploadField
          label="Add a photo"
          value=""
          onChange={(url) => set('images', [...values.images, url])}
          accept="image/jpeg,image/png,image/webp"
          kind="image"
        />
      </Field>

      <Field label="Features">
        <FeaturePicker
          selected={values.features.split(',').map((s) => s.trim()).filter(Boolean)}
          onChange={(next) => set('features', next.join(', '))}
        />
      </Field>

      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={values.instantBook} onChange={(e) => set('instantBook', e.target.checked)} className="w-4 h-4 accent-amber-500" />
          <span className="text-sm text-gray-700">Allow Instant Book (skip host approval)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={values.offersPickup} onChange={(e) => set('offersPickup', e.target.checked)} className="w-4 h-4 accent-amber-500" />
          <span className="text-sm text-gray-700">Offer to pick up the car from the guest at drop-off</span>
        </label>
        {values.offersPickup && (
          <Field label="Pickup Fee (₹)">
            <input type="number" min={0} value={values.pickupFee} onChange={(e) => set('pickupFee', Number(e.target.value))} className={`${inputCls} max-w-[200px]`} />
          </Field>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={values.offersDelivery} onChange={(e) => set('offersDelivery', e.target.checked)} className="w-4 h-4 accent-amber-500" />
          <span className="text-sm text-gray-700">Offer doorstep delivery to the guest</span>
        </label>
        {values.offersDelivery && (
          <Field label="Delivery Fee (₹)">
            <input type="number" min={0} value={values.deliveryFee} onChange={(e) => set('deliveryFee', Number(e.target.value))} className={`${inputCls} max-w-[200px]`} />
          </Field>
        )}
        {values.securityDeposit === 0 && (
          <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
            ✓ Security deposit is ₹0 — this listing will show a "Zero Deposit" badge to renters.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full btn-gradient disabled:!bg-none disabled:bg-gray-300 disabled:!shadow-none text-white font-bold py-3 rounded-xl transition"
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
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
