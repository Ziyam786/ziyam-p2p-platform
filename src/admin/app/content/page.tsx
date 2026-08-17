'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { CategoryDef, CityDef, Testimonial, TrustBadge } from '../../lib/types';

function SectionCard({ title, desc, children, onSave, saving }: {
  title: string; desc: string; children: React.ReactNode; onSave: () => void; saving: boolean;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-slate-100">{title}</h2>
          <p className="text-xs text-slate-500">{desc}</p>
        </div>
        <button onClick={onSave} disabled={saving} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {children}
    </div>
  );
}

const rowInput = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function ContentPage() {
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [badges, setBadges] = useState<TrustBadge[]>([]);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [cities, setCities] = useState<CityDef[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  useEffect(() => {
    adminApi
      .settings()
      .then((res) => {
        const byKey = new Map(res.data.map((s) => [s.key, s.value]));
        setHeroTitle((byKey.get('hero_title') as string) ?? '');
        setHeroSubtitle((byKey.get('hero_subtitle') as string) ?? '');
        setBadges((byKey.get('trust_badges') as TrustBadge[]) ?? []);
        setCategories((byKey.get('categories') as CategoryDef[]) ?? []);
        setCities((byKey.get('cities') as CityDef[]) ?? []);
        setTestimonials((byKey.get('testimonials') as Testimonial[]) ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(key: string, value: unknown, label: string) {
    setSavingKey(key);
    try {
      await adminApi.updateSetting(key, value);
      show(`${label} updated — live on the lessee site now`, 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to save', 'error');
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <AdminShell title="Site Content" subtitle="Edit what lessees see on the live site">
        <p className="text-slate-500">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Site Content" subtitle="Edit what lessees see on the live site — changes go live immediately, no deploy needed">
      <div className="space-y-6">
        <SectionCard
          title="Homepage Hero"
          desc="The big headline and subtext on the homepage"
          onSave={() => Promise.all([save('hero_title', heroTitle, 'Hero title'), save('hero_subtitle', heroSubtitle, 'Hero subtitle')])}
          saving={savingKey === 'hero_title' || savingKey === 'hero_subtitle'}
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Title (use a new line for each line break)</label>
              <textarea value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} rows={3} className={`${rowInput} w-full`} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Subtitle</label>
              <textarea value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} rows={2} className={`${rowInput} w-full`} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Trust Badges"
          desc="The four stat callouts on the hero (e.g. '1 Lakh+ Happy Lessees')"
          onSave={() => save('trust_badges', badges, 'Trust badges')}
          saving={savingKey === 'trust_badges'}
        >
          <div className="space-y-2">
            {badges.map((b, i) => (
              <div key={i} className="flex gap-2">
                <input value={b.label} onChange={(e) => setBadges((arr) => arr.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="1 Lakh+" className={`${rowInput} flex-1`} />
                <input value={b.sub} onChange={(e) => setBadges((arr) => arr.map((x, j) => j === i ? { ...x, sub: e.target.value } : x))} placeholder="Happy Lessees" className={`${rowInput} flex-1`} />
                <button onClick={() => setBadges((arr) => arr.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 px-2 text-sm">✕</button>
              </div>
            ))}
            <button onClick={() => setBadges((arr) => [...arr, { label: '', sub: '' }])} className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
              + Add badge
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Categories"
          desc="Browse-by-category tiles on the homepage and cars page filter"
          onSave={() => save('categories', categories, 'Categories')}
          saving={savingKey === 'categories'}
        >
          <div className="space-y-2">
            {categories.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input value={c.icon} onChange={(e) => setCategories((arr) => arr.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))} placeholder="🚘" className={`${rowInput} w-14`} />
                <input value={c.label} onChange={(e) => setCategories((arr) => arr.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Hatchback" className={`${rowInput} flex-1`} />
                <input value={c.desc} onChange={(e) => setCategories((arr) => arr.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} placeholder="Compact & affordable" className={`${rowInput} flex-[2]`} />
                <button onClick={() => setCategories((arr) => arr.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 px-2 text-sm">✕</button>
              </div>
            ))}
            <button onClick={() => setCategories((arr) => [...arr, { label: '', icon: '🚗', desc: '' }])} className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
              + Add category
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Cities"
          desc="Top cities shown on the homepage and used as filters/dropdowns everywhere"
          onSave={() => save('cities', cities, 'Cities')}
          saving={savingKey === 'cities'}
        >
          <div className="space-y-2">
            {cities.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input value={c.emoji} onChange={(e) => setCities((arr) => arr.map((x, j) => j === i ? { ...x, emoji: e.target.value } : x))} placeholder="🏙️" className={`${rowInput} w-14`} />
                <input value={c.name} onChange={(e) => setCities((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Bengaluru" className={`${rowInput} flex-1`} />
                <button onClick={() => setCities((arr) => arr.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 px-2 text-sm">✕</button>
              </div>
            ))}
            <button onClick={() => setCities((arr) => [...arr, { name: '', emoji: '🏙️' }])} className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
              + Add city
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Testimonials"
          desc="Lessee/host quotes shown on the homepage"
          onSave={() => save('testimonials', testimonials, 'Testimonials')}
          saving={savingKey === 'testimonials'}
        >
          <div className="space-y-3">
            {testimonials.map((t, i) => (
              <div key={i} className="border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <input value={t.name} onChange={(e) => setTestimonials((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Ananya R." className={`${rowInput} flex-1`} />
                  <select
                    value={t.rating}
                    onChange={(e) => setTestimonials((arr) => arr.map((x, j) => j === i ? { ...x, rating: Number(e.target.value) } : x))}
                    className={rowInput}
                  >
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                  </select>
                  <button onClick={() => setTestimonials((arr) => arr.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 px-2 text-sm">✕</button>
                </div>
                <textarea
                  value={t.quote}
                  onChange={(e) => setTestimonials((arr) => arr.map((x, j) => j === i ? { ...x, quote: e.target.value } : x))}
                  rows={2}
                  placeholder="Quote..."
                  className={`${rowInput} w-full`}
                />
              </div>
            ))}
            <button onClick={() => setTestimonials((arr) => [...arr, { name: '', quote: '', rating: 5 }])} className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
              + Add testimonial
            </button>
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
