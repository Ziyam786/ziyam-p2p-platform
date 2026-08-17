'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '../../../components/ProtectedRoute';
import Tabs from '../../../components/Tabs';
import StatCard from '../../../components/StatCard';
import Rating from '../../../components/Rating';
import { LogoBadge } from '../../../components/Logo';
import BlackoutManager from '../../../components/BlackoutManager';
import BookingRequestsPanel from '../../../components/BookingRequestsPanel';
import YieldBadge from '../../../components/YieldBadge';
import { useAuth } from '../../../lib/auth-context';
import { useToast } from '../../../components/Toast';
import { hostApi, carsApi, hostReviewApi, usersApi, ApiError } from '../../../lib/api';
import type { Car, EarningsOverview, UtilizationEntry } from '../../../lib/types';

const EMPTY: EarningsOverview = {
  totalGross: 0, ziyamCut: 0, netEarnings: 0, pendingEscrow: 0, settledPayouts: 0,
};

function DashboardInner() {
  const { user, refresh } = useAuth();
  const { show } = useToast();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') ?? 'overview');
  const [metrics, setMetrics] = useState<EarningsOverview>(EMPTY);
  const [cars, setCars] = useState<Car[]>([]);
  const [utilization, setUtilization] = useState<UtilizationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [blackoutCar, setBlackoutCar] = useState<Car | null>(null);
  const [requestCount, setRequestCount] = useState(0);

  function loadRequestCount() {
    hostReviewApi.requests().then((res) => setRequestCount(res.count)).catch(() => {});
  }

  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [verifyingBank, setVerifyingBank] = useState(false);

  async function handleVerifyBank(e: React.FormEvent) {
    e.preventDefault();
    setVerifyingBank(true);
    try {
      await usersApi.verifyBankAccount(bankIfsc.trim().toUpperCase(), bankAccountNumber.trim());
      show('Bank account verified — payouts are now enabled on your cars', 'success');
      setBankIfsc('');
      setBankAccountNumber('');
      await refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not verify bank account', 'error');
    } finally {
      setVerifyingBank(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([hostApi.earnings(user.id), hostApi.myCars(user.id), hostApi.utilization(user.id)])
      .then(([earnings, myCars, util]) => {
        if (!active) return;
        setMetrics(earnings.data);
        setCars(myCars.data);
        setUtilization(util.data);
      })
      .catch((err) => show(err.message ?? 'Failed to load dashboard data', 'error'))
      .finally(() => active && setLoading(false));
    loadRequestCount();
    return () => {
      active = false;
    };
  }, [user, show]);

  async function toggleAvailability(car: Car) {
    try {
      const res = await carsApi.update(car.id, { isAvailable: !car.isAvailable });
      setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, isAvailable: res.data.isAvailable } : c)));
    } catch (err: any) {
      show(err.message ?? 'Failed to update listing', 'error');
    }
  }

  async function delistCar(car: Car) {
    if (!confirm(`Delist ${car.make} ${car.model}? It will be hidden from search.`)) return;
    try {
      await carsApi.delist(car.id);
      setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, isAvailable: false } : c)));
      show('Listing delisted', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to delist', 'error');
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <header className="px-8 pt-8 mb-6 flex flex-wrap gap-4 justify-between items-center border-b border-gray-800 pb-5">
        <div className="flex items-center gap-3">
          <LogoBadge className="w-10 h-10 shrink-0 rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-amber-500">
              Ziyam <span className="text-white text-lg font-normal">| Fleet Control Center</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">Welcome back, {user?.fullName.split(' ')[0]}</p>
          </div>
        </div>
        <a
          href="/host/cars/new"
          className="btn-gradient text-black font-semibold px-5 py-2.5 rounded-lg transition"
        >
          + Add New Vehicle
        </a>
      </header>

      {user && !(user.partnerAgreementWetSignedUrl && user.partnerAgreementEsignStatus === 'sign_complete') && (
        <div className="mx-8 mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-300">
            ⚠ Your Host Onboarding Agreement isn't fully signed yet — payouts are on hold until it is.
          </p>
          <a href="/host/agreement" className="text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-950 px-4 py-2 rounded-lg transition whitespace-nowrap">
            Complete Agreement
          </a>
        </div>
      )}

      {user && !user.payoutAccountId && (
        <div className="mx-8 mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-red-300">
            ⚠ No payout account on file yet — your cars can&apos;t be booked until you verify a bank account.
          </p>
          <button onClick={() => setTab('payout')} className="text-xs font-bold bg-red-500 hover:bg-red-400 text-gray-950 px-4 py-2 rounded-lg transition whitespace-nowrap">
            Set Up Payouts
          </button>
        </div>
      )}

      <div className="px-8">
        <Tabs
          variant="dark"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: 'Overview' },
            { key: 'requests', label: `Booking Requests${requestCount > 0 ? ` (${requestCount})` : ''}` },
            { key: 'cars', label: `My Cars (${cars.length})` },
            { key: 'utilization', label: 'Utilization' },
            { key: 'payout', label: 'Payout Setup' },
          ]}
        />
      </div>

      <div className="p-8">
        {loading ? (
          <p className="text-gray-400">Loading dashboard…</p>
        ) : tab === 'overview' ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard label="Total Fleet Revenue" value={metrics.totalGross} sub="Gross rental bookings" />
            <StatCard label="Ziyam Platform Cut (30%)" value={-metrics.ziyamCut} sub="Platform, marketing & support" tone="negative" />
            <StatCard label="Your Net Profit (70%)" value={metrics.netEarnings} sub="Host direct share" tone="positive" />
            <StatCard label="Escrow Queue (N+1)" value={metrics.pendingEscrow} sub="Releasing per settlement policy" tone="warning" />
          </div>
        ) : tab === 'requests' ? (
          <BookingRequestsPanel onChanged={loadRequestCount} />
        ) : tab === 'cars' ? (
          <div className="space-y-4">
            {cars.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-xs text-gray-400">
                💡 Got a car that's temporarily unavailable? Pause it below (or from Manage → Controls) to
                avoid booking requests you'll just have to decline.
              </div>
            )}
            {cars.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl">
                <p className="text-gray-400 mb-4">You haven't listed any cars yet.</p>
                <a href="/host/cars/new" className="text-amber-400 font-semibold underline">List your first car</a>
              </div>
            ) : (
              cars.map((car) => (
                <div key={car.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-wrap items-center gap-5">
                  <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-gray-800 shrink-0">
                    <Image src={car.images?.[0] ?? '/placeholder-car.jpg'} alt="" fill sizes="96px" className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-bold">{car.make} {car.model} <span className="text-gray-500 font-normal text-sm">({car.year})</span></p>
                    <p className="text-xs text-gray-400">
                      {car.registrationNo} · {car.city} · ₹{car.dailyRate}/day (₹{Math.round(car.dailyRate / 24)}/hr)
                      {' · '}
                      <span className="text-emerald-400 font-semibold">
                        you earn ≈ ₹{Math.round((car.dailyRate / 24) * (metrics.totalGross > 0 ? metrics.netEarnings / metrics.totalGross : 0.7))}/hr
                      </span>
                    </p>
                    <div className="mt-1"><Rating value={car.rating} count={car.reviewCount} /></div>
                    <div className="mt-2">
                      <YieldBadge
                        car={car}
                        onApplied={(newRate) => setCars((prev) => prev.map((c) => (c.id === car.id ? { ...c, dailyRate: newRate } : c)))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${car.isAvailable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {car.isAvailable ? 'Live' : 'Delisted'}
                    </span>
                    {car.verificationStatus === 'REJECTED' ? (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-500/10 text-red-400" title="Re-upload corrected documents from Edit">
                        Docs rejected
                      </span>
                    ) : car.verificationStatus === 'PENDING' ? (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400">
                        Docs pending review
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                        Docs verified
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a href={`/host/cars/${car.id}/manage`} className="text-xs font-semibold border border-amber-500/50 hover:border-amber-500 text-amber-400 px-3 py-2 rounded-lg transition">
                      Manage
                    </a>
                    <a href={`/host/cars/${car.id}/edit`} className="text-xs font-semibold border border-gray-700 hover:border-amber-500 text-gray-300 hover:text-amber-400 px-3 py-2 rounded-lg transition">
                      Edit
                    </a>
                    <button onClick={() => setBlackoutCar(car)} className="text-xs font-semibold border border-gray-700 hover:border-amber-500 text-gray-300 hover:text-amber-400 px-3 py-2 rounded-lg transition">
                      Availability
                    </button>
                    <button onClick={() => toggleAvailability(car)} className="text-xs font-semibold border border-gray-700 hover:border-amber-500 text-gray-300 hover:text-amber-400 px-3 py-2 rounded-lg transition">
                      {car.isAvailable ? 'Pause' : 'Reactivate'}
                    </button>
                    <button onClick={() => delistCar(car)} className="text-xs font-semibold border border-gray-700 hover:border-red-500 text-gray-300 hover:text-red-400 px-3 py-2 rounded-lg transition">
                      Delist
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : tab === 'utilization' ? (
          <div className="space-y-3">
            {utilization.length === 0 ? (
              <p className="text-gray-400">No utilization data yet — complete some trips first.</p>
            ) : (
              utilization.map((u) => (
                <div key={u.carId} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold">{u.label}</span>
                    <span className="text-amber-400 font-bold">{u.utilizationPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${u.utilizationPercent}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-1">Payout Bank Account</h3>
              {user?.payoutAccountId ? (
                <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
                  <span className="text-emerald-400 text-lg">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">Verified — payouts are enabled</p>
                    {user.bankNameAtBank && <p className="text-xs text-gray-400 mt-0.5">{user.bankNameAtBank} · account ending {user.bankAccountNumber?.slice(-4)}</p>}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-400 mb-4">Verify a bank account to start receiving payouts — this unlocks bookings on all your listed cars.</p>
                  <form onSubmit={handleVerifyBank} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">IFSC Code</span>
                      <input
                        required value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)}
                        placeholder="HDFC0001234" maxLength={11}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Account Number</span>
                      <input
                        required value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </label>
                    <button
                      type="submit" disabled={verifyingBank}
                      className="sm:col-span-2 btn-gradient text-black font-semibold py-2.5 rounded-lg transition disabled:opacity-60"
                    >
                      {verifyingBank ? 'Verifying…' : 'Verify Bank Account'}
                    </button>
                  </form>
                </>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4">Payout Schedule & Settlement Terms</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
                <Policy title="70/30 Revenue Split" body="You keep 70% of the base fare. Ziyam takes 30% for marketing, platform tech, dynamic pricing, and support." />
                <Policy title="N+1 Settlement Policy" body="Self-hosted payouts settle 24-48 hours after trip end (or weekly if you opt in); fleet-managed cars settle within 1 day of receipt confirmation." />
                <Policy title="Security Deposit" body="Lessee security deposits are held in escrow and applied to damage or toll costs first — see the full Insurance & Damage Policy for how recovery beyond the deposit works." />
              </div>
            </div>
          </div>
        )}
      </div>

      {blackoutCar && <BlackoutManager car={blackoutCar} onClose={() => setBlackoutCar(null)} />}
    </div>
  );
}

function Policy({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-4 bg-gray-950 rounded-lg border border-gray-800">
      <span className="font-semibold text-amber-400">{title}</span>
      <p className="text-xs text-gray-400 mt-1">{body}</p>
    </div>
  );
}

export default function FleetOperatorDashboard() {
  return (
    <ProtectedRoute roles={['SELF_HOST', 'FLEET_OPERATOR']}>
      <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
        <DashboardInner />
      </Suspense>
    </ProtectedRoute>
  );
}
