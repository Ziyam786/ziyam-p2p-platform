'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi } from '../../lib/api';
import type { LongRentalDiscount, ProtectionPlanDef } from '../../lib/types';

interface CompanyInfo {
  legalName: string; brand: string; brandFull: string; cin: string; registeredDate: string;
  address: string; email: string; phone: string; whatsappUrl: string; operatingCity: string;
  scopeNote: string; jurisdiction: string; team: { name: string; role: string }[];
}

interface DemandPricing {
  weekendBump: number; peakHourBump: number; peakHours: [number, number][];
  holidayBump: number; maxMultiplier: number; publicHolidays: string[];
}

const rowInput = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function SettingsPage() {
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [commission, setCommission] = useState(30);
  const [settlementHours, setSettlementHours] = useState(24);
  const [plans, setPlans] = useState<ProtectionPlanDef[]>([]);
  const [discounts, setDiscounts] = useState<LongRentalDiscount[]>([]);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [savingAi, setSavingAi] = useState(false);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [demand, setDemand] = useState<DemandPricing | null>(null);
  const [holidaysText, setHolidaysText] = useState('');
  const [savingDemand, setSavingDemand] = useState(false);

  const [gstin, setGstin] = useState('');
  const [homeState, setHomeState] = useState('Karnataka');
  const [gstRate, setGstRate] = useState(5);
  const [savingGst, setSavingGst] = useState(false);

  useEffect(() => {
    adminApi
      .settings()
      .then((res) => {
        const byKey = new Map(res.data.map((s) => [s.key, s.value]));
        const commissionPct = (byKey.get('commission_percentage') as number) ?? 0.3;
        setCommission(Math.round(commissionPct * 100));
        setSettlementHours((byKey.get('settlement_hours') as number) ?? 24);
        setPlans((byKey.get('protection_plans') as ProtectionPlanDef[]) ?? []);
        setDiscounts((byKey.get('long_rental_discounts') as LongRentalDiscount[]) ?? []);
        setAiEnabled((byKey.get('ai_chat_enabled') as boolean) ?? true);
        setAiPrompt((byKey.get('ai_chat_system_prompt') as string) ?? '');
        setCompany((byKey.get('company_info') as CompanyInfo) ?? null);
        const d = byKey.get('demand_pricing') as DemandPricing | undefined;
        if (d) {
          setDemand(d);
          setHolidaysText(d.publicHolidays.join('\n'));
        }
        setGstin((byKey.get('company_gstin') as string) ?? '');
        setHomeState((byKey.get('company_home_state') as string) ?? 'Karnataka');
        setGstRate(Math.round(((byKey.get('default_gst_rate') as number) ?? 0.05) * 100));
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveGstSettings() {
    setSavingGst(true);
    try {
      await Promise.all([
        adminApi.updateSetting('company_gstin', gstin),
        adminApi.updateSetting('company_home_state', homeState),
        adminApi.updateSetting('default_gst_rate', gstRate / 100),
      ]);
      show('GST settings updated', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to save', 'error');
    } finally {
      setSavingGst(false);
    }
  }

  async function saveCompanySettings() {
    if (!company) return;
    setSavingCompany(true);
    try {
      await adminApi.updateSetting('company_info', company);
      show('Business info updated — reflected across the site footer & About page', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to save', 'error');
    } finally {
      setSavingCompany(false);
    }
  }

  async function saveDemandPricing() {
    if (!demand) return;
    setSavingDemand(true);
    try {
      const publicHolidays = holidaysText.split('\n').map((s) => s.trim()).filter(Boolean);
      await adminApi.updateSetting('demand_pricing', { ...demand, publicHolidays });
      show('Demand pricing updated', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to save', 'error');
    } finally {
      setSavingDemand(false);
    }
  }

  async function savePayoutSettings() {
    setSaving(true);
    try {
      const commissionFraction = commission / 100;
      await Promise.all([
        adminApi.updateSetting('commission_percentage', commissionFraction),
        adminApi.updateSetting('host_share_percentage', Number((1 - commissionFraction).toFixed(2))),
        adminApi.updateSetting('settlement_hours', settlementHours),
        adminApi.updateSetting('protection_plans', plans),
        adminApi.updateSetting('long_rental_discounts', discounts),
      ]);
      show('Payout & pricing settings updated', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveAiSettings() {
    setSavingAi(true);
    try {
      await Promise.all([
        adminApi.updateSetting('ai_chat_enabled', aiEnabled),
        adminApi.updateSetting('ai_chat_system_prompt', aiPrompt),
      ]);
      show('AI assistant settings updated', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to save', 'error');
    } finally {
      setSavingAi(false);
    }
  }

  if (loading) {
    return (
      <AdminShell title="Platform Settings" subtitle="Business config that's usually hardcoded — now live-editable">
        <p className="text-slate-500">Loading…</p>
      </AdminShell>
    );
  }

  const hostShare = 100 - commission;

  return (
    <AdminShell title="Platform Settings" subtitle="Business config that's usually hardcoded — now live-editable">
      <div className="space-y-6">
        {company && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-bold text-slate-100 mb-1">Business Info</h2>
            <p className="text-xs text-slate-500 mb-5">Powers the site footer, About page, and legal page contact details</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Legal Entity Name</label>
                <input value={company.legalName} onChange={(e) => setCompany({ ...company, legalName: e.target.value })} className={`${rowInput} w-full`} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">CIN</label>
                <input value={company.cin} onChange={(e) => setCompany({ ...company, cin: e.target.value })} className={`${rowInput} w-full`} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email</label>
                <input value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} className={`${rowInput} w-full`} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Phone / WhatsApp Number</label>
                <input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} className={`${rowInput} w-full`} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Registered Address</label>
                <input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} className={`${rowInput} w-full`} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Operating Scope Note</label>
                <input value={company.scopeNote} onChange={(e) => setCompany({ ...company, scopeNote: e.target.value })} className={`${rowInput} w-full`} />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-slate-300 mb-2">Leadership Team</h3>
            <div className="space-y-2 mb-5">
              {company.team.map((person, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={person.name}
                    onChange={(e) => setCompany({ ...company, team: company.team.map((p, j) => j === i ? { ...p, name: e.target.value } : p) })}
                    placeholder="Name" className={`${rowInput} flex-1`}
                  />
                  <input
                    value={person.role}
                    onChange={(e) => setCompany({ ...company, team: company.team.map((p, j) => j === i ? { ...p, role: e.target.value } : p) })}
                    placeholder="Role" className={`${rowInput} flex-1`}
                  />
                  <button onClick={() => setCompany({ ...company, team: company.team.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-300 px-2 text-sm">✕</button>
                </div>
              ))}
              <button onClick={() => setCompany({ ...company, team: [...company.team, { name: '', role: '' }] })} className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
                + Add team member
              </button>
            </div>

            <button onClick={saveCompanySettings} disabled={savingCompany} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">
              {savingCompany ? 'Saving…' : 'Save Business Info'}
            </button>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="font-bold text-slate-100 mb-1">Revenue Split & Settlement</h2>
          <p className="text-xs text-slate-500 mb-5">Applies to every new booking created after saving</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Ziyam Commission: {commission}% (host keeps {hostShare}%)</label>
              <input type="range" min={5} max={50} value={commission} onChange={(e) => setCommission(Number(e.target.value))} className="w-full accent-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">N+1 Settlement Window (hours after trip end)</label>
              <input type="number" min={1} value={settlementHours} onChange={(e) => setSettlementHours(Number(e.target.value))} className={`${rowInput} w-full`} />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-300 mb-2">Protection Plan Pricing</h3>
          <div className="space-y-2 mb-5">
            {plans.map((p, i) => (
              <div key={p.value} className="flex gap-2 items-center">
                <span className="w-24 text-xs text-slate-400">{p.label}</span>
                <input
                  type="number" min={0}
                  value={p.ratePerDay}
                  onChange={(e) => setPlans((arr) => arr.map((x, j) => j === i ? { ...x, ratePerDay: Number(e.target.value) } : x))}
                  className={`${rowInput} w-28`}
                />
                <span className="text-xs text-slate-500">₹/day</span>
                <input
                  value={p.desc}
                  onChange={(e) => setPlans((arr) => arr.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))}
                  className={`${rowInput} flex-1`}
                />
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-slate-300 mb-2">Long-Rental Discounts</h3>
          <div className="space-y-2 mb-5">
            {discounts.map((d, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs text-slate-400">Days ≥</span>
                <input
                  type="number" min={1}
                  value={d.minDays}
                  onChange={(e) => setDiscounts((arr) => arr.map((x, j) => j === i ? { ...x, minDays: Number(e.target.value) } : x))}
                  className={`${rowInput} w-20`}
                />
                <span className="text-xs text-slate-400">→</span>
                <input
                  type="number" min={0} max={100}
                  value={Math.round(d.percent * 100)}
                  onChange={(e) => setDiscounts((arr) => arr.map((x, j) => j === i ? { ...x, percent: Number(e.target.value) / 100 } : x))}
                  className={`${rowInput} w-20`}
                />
                <span className="text-xs text-slate-400">% off</span>
                <button onClick={() => setDiscounts((arr) => arr.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 px-2 text-sm ml-auto">✕</button>
              </div>
            ))}
            <button onClick={() => setDiscounts((arr) => [...arr, { minDays: 3, percent: 0.05 }])} className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
              + Add discount tier
            </button>
          </div>

          <button onClick={savePayoutSettings} disabled={saving} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">
            {saving ? 'Saving…' : 'Save Payout & Pricing Settings'}
          </button>
        </div>

        {demand && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="font-bold text-slate-100 mb-1">Demand Pricing</h2>
            <p className="text-xs text-slate-500 mb-5">
              Lessee-facing surge on top of a car's listed rate — bumps stack additively and are capped at the max
              multiplier below. Keyed off the trip's pickup time.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Weekend Bump (%)</label>
                <input type="number" min={0} max={100} value={Math.round(demand.weekendBump * 100)} onChange={(e) => setDemand({ ...demand, weekendBump: Number(e.target.value) / 100 })} className={`${rowInput} w-full`} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Peak Hour Bump (%)</label>
                <input type="number" min={0} max={100} value={Math.round(demand.peakHourBump * 100)} onChange={(e) => setDemand({ ...demand, peakHourBump: Number(e.target.value) / 100 })} className={`${rowInput} w-full`} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Holiday Bump (%)</label>
                <input type="number" min={0} max={100} value={Math.round(demand.holidayBump * 100)} onChange={(e) => setDemand({ ...demand, holidayBump: Number(e.target.value) / 100 })} className={`${rowInput} w-full`} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Max Multiplier (×)</label>
                <input type="number" min={1} step={0.1} value={demand.maxMultiplier} onChange={(e) => setDemand({ ...demand, maxMultiplier: Number(e.target.value) })} className={`${rowInput} w-full`} />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-slate-300 mb-2">Peak Hour Windows</h3>
            <div className="space-y-2 mb-5">
              {demand.peakHours.map(([start, end], i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input type="number" min={0} max={23} value={start} onChange={(e) => setDemand({ ...demand, peakHours: demand.peakHours.map((w, j) => j === i ? [Number(e.target.value), w[1]] : w) as [number, number][] })} className={`${rowInput} w-20`} />
                  <span className="text-xs text-slate-400">to</span>
                  <input type="number" min={0} max={23} value={end} onChange={(e) => setDemand({ ...demand, peakHours: demand.peakHours.map((w, j) => j === i ? [w[0], Number(e.target.value)] : w) as [number, number][] })} className={`${rowInput} w-20`} />
                  <span className="text-xs text-slate-400">(24hr)</span>
                  <button onClick={() => setDemand({ ...demand, peakHours: demand.peakHours.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-300 px-2 text-sm ml-auto">✕</button>
                </div>
              ))}
              <button onClick={() => setDemand({ ...demand, peakHours: [...demand.peakHours, [7, 10]] })} className="text-xs text-brand-400 hover:text-brand-300 font-semibold">
                + Add peak window
              </button>
            </div>

            <h3 className="text-sm font-semibold text-slate-300 mb-2">Public Holidays (one date per line, YYYY-MM-DD)</h3>
            <textarea
              value={holidaysText}
              onChange={(e) => setHolidaysText(e.target.value)}
              rows={5}
              className={`${rowInput} w-full mb-5 font-mono text-xs`}
            />

            <button onClick={saveDemandPricing} disabled={savingDemand} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">
              {savingDemand ? 'Saving…' : 'Save Demand Pricing'}
            </button>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="font-bold text-slate-100 mb-1">GST / Invoicing</h2>
          <p className="text-xs text-slate-500 mb-5">
            Powers the tax breakdown on generated invoices. GSTIN is empty until you enter the real registered
            number — the rate below is a placeholder; confirm your actual applicable rate with a tax advisor before
            relying on invoices for filing.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Company GSTIN</label>
              <input value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="Not yet entered" className={`${rowInput} w-full`} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Home State (for CGST+SGST vs IGST)</label>
              <input value={homeState} onChange={(e) => setHomeState(e.target.value)} className={`${rowInput} w-full`} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Default GST Rate (%)</label>
              <input type="number" min={0} max={28} value={gstRate} onChange={(e) => setGstRate(Number(e.target.value))} className={`${rowInput} w-full`} />
            </div>
          </div>
          <button onClick={saveGstSettings} disabled={savingGst} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">
            {savingGst ? 'Saving…' : 'Save GST Settings'}
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-slate-100">AI Support Assistant</h2>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} className="w-4 h-4 accent-brand-500" />
              Enabled on the lessee site
            </label>
          </div>
          <p className="text-xs text-slate-500 mb-4">System prompt the chatbot uses to answer lessee/host questions</p>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={8}
            className={`${rowInput} w-full mb-4 font-mono text-xs`}
          />
          <button onClick={saveAiSettings} disabled={savingAi} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">
            {savingAi ? 'Saving…' : 'Save AI Settings'}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
