'use client';

import React, { useEffect, useState } from 'react';
import AdminShell from '../../components/AdminShell';
import { useToast } from '../../components/Toast';
import { adminApi, fleetApi, type FleetFilters } from '../../lib/api';
import type { AdminCar, FleetExpenseRow, FleetSummary, JournalEntryRow, PlatformBookingEntry } from '../../lib/types';

const rowInput = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500';
// Fallbacks only — the real lists are admin-editable via Settings ->
// "Fleet Ledger Lists" (fleet_platforms / fleet_ledger_categories /
// fleet_expense_types / fleet_payment_modes), fetched below on mount.
const PLATFORMS_FALLBACK = ['ZOOMCAR', 'REVV', 'BHARAT', 'MARC8'];
const CATEGORIES_FALLBACK = ['FASTAG', 'FUEL', 'INSTANCES', 'WASHING', 'DAMAGE'];
const EXPENSE_TYPES_FALLBACK = ['ROUTINE_MAINTENANCE', 'INSURANCE_PREMIUMS', 'STATE_PERMITS', 'ROAD_TAX', 'DRIVER_SALARIES', 'GENERAL_ADMIN'];
const PAYMENT_MODES_FALLBACK = ['CASH', 'UPI', 'CORPORATE_CARD', 'FLEET_FUEL_CARD'];

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function label(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function FleetLedgerPage() {
  const { show } = useToast();
  const [cars, setCars] = useState<AdminCar[]>([]);
  const [tab, setTab] = useState<'bookings' | 'journal' | 'expenses'>('bookings');
  const [summary, setSummary] = useState<FleetSummary | null>(null);

  const [filters, setFilters] = useState<FleetFilters>({});

  const [bookings, setBookings] = useState<PlatformBookingEntry[]>([]);
  const [journal, setJournal] = useState<JournalEntryRow[]>([]);
  const [expenses, setExpenses] = useState<FleetExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [platforms, setPlatforms] = useState<string[]>(PLATFORMS_FALLBACK);
  const [categories, setCategories] = useState<string[]>(CATEGORIES_FALLBACK);
  const [expenseTypes, setExpenseTypes] = useState<string[]>(EXPENSE_TYPES_FALLBACK);
  const [paymentModes, setPaymentModes] = useState<string[]>(PAYMENT_MODES_FALLBACK);

  useEffect(() => {
    adminApi.cars().then((res) => setCars(res.data)).catch(() => {});
    adminApi.settings().then((res) => {
      const byKey = new Map(res.data.map((s) => [s.key, s.value]));
      const asList = (key: string, fallback: string[]) => {
        const v = byKey.get(key);
        return Array.isArray(v) && v.length ? (v as string[]) : fallback;
      };
      setPlatforms(asList('fleet_platforms', PLATFORMS_FALLBACK));
      setCategories(asList('fleet_ledger_categories', CATEGORIES_FALLBACK));
      setExpenseTypes(asList('fleet_expense_types', EXPENSE_TYPES_FALLBACK));
      setPaymentModes(asList('fleet_payment_modes', PAYMENT_MODES_FALLBACK));
    }).catch(() => {});
  }, []);

  function load() {
    setLoading(true);
    Promise.all([
      fleetApi.summary(filters),
      fleetApi.bookings(filters),
      fleetApi.journalEntries(filters),
      fleetApi.expenses(filters),
    ])
      .then(([s, b, j, e]) => {
        setSummary(s.data);
        setBookings(b.data);
        setJournal(j.data);
        setExpenses(e.data);
      })
      .catch((err) => show(err.message ?? 'Failed to load ledger data', 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filters.carId, filters.platform, filters.category, filters.expenseType, filters.from, filters.to]);

  return (
    <AdminShell title="Fleet Financial Ledger" subtitle="Cross-platform revenue, collections & expenses — Zoomcar, Revv, Bharat, Marc8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Platform Revenue" value={summary?.totalRevenue ?? 0} tone="positive" />
        <StatCard label="Collections" value={summary?.totalCollected ?? 0} tone="positive" />
        <StatCard label="Expenses" value={summary?.totalExpenses ?? 0} tone="negative" />
        <StatCard label="Net Position" value={summary?.netPosition ?? 0} tone={((summary?.netPosition ?? 0) >= 0) ? 'positive' : 'negative'} />
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Car</label>
          <select value={filters.carId ?? ''} onChange={(e) => setFilters((f) => ({ ...f, carId: e.target.value || undefined }))} className={rowInput}>
            <option value="">All Cars</option>
            {cars.map((c) => <option key={c.id} value={c.id}>{c.make} {c.model} · {c.registrationNo}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Platform</label>
          <select value={filters.platform ?? ''} onChange={(e) => setFilters((f) => ({ ...f, platform: e.target.value || undefined }))} className={rowInput}>
            <option value="">All Platforms</option>
            {platforms.map((p) => <option key={p} value={p}>{label(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Category</label>
          <select value={filters.category ?? ''} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))} className={rowInput}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input type="date" value={filters.from ?? ''} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))} className={rowInput} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input type="date" value={filters.to ?? ''} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))} className={rowInput} />
        </div>
        {(filters.carId || filters.platform || filters.category || filters.from || filters.to) && (
          <button onClick={() => setFilters({})} className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-2">
            Clear filters
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800 mb-6">
        {(['bookings', 'journal', 'expenses'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 transition ${
              tab === t ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'bookings' ? `Platform Bookings (${bookings.length})` : t === 'journal' ? `Journal Entries (${journal.length})` : `Expenses (${expenses.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : tab === 'bookings' ? (
        <BookingsTab cars={cars} rows={bookings} busy={busy} setBusy={setBusy} onChange={load} show={show} platforms={platforms} />
      ) : tab === 'journal' ? (
        <JournalTab cars={cars} rows={journal} busy={busy} setBusy={setBusy} onChange={load} show={show} categories={categories} />
      ) : (
        <ExpensesTab cars={cars} rows={expenses} busy={busy} setBusy={setBusy} onChange={load} show={show} expenseTypes={expenseTypes} paymentModes={paymentModes} />
      )}
    </AdminShell>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'positive' | 'negative' }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-extrabold ${tone === 'positive' ? 'text-emerald-400' : 'text-red-400'}`}>{inr(value)}</p>
    </div>
  );
}

/* ── Platform Bookings tab ────────────────────────────────────────────── */
function BookingsTab({ cars, rows, busy, setBusy, onChange, show, platforms }: {
  cars: AdminCar[]; rows: PlatformBookingEntry[]; busy: boolean; setBusy: (b: boolean) => void; onChange: () => void; show: (m: string, t: 'success' | 'error') => void; platforms: string[];
}) {
  const [carId, setCarId] = useState('');
  const [platform, setPlatform] = useState(platforms[0] ?? 'ZOOMCAR');
  const [externalBookingId, setExternalBookingId] = useState('');
  const [bookedAt, setBookedAt] = useState('');
  const [totalFare, setTotalFare] = useState('');
  const [doorstepCharges, setDoorstepCharges] = useState('');
  const [platformCommission, setPlatformCommission] = useState('');
  const [expectedCreditDate, setExpectedCreditDate] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!carId || !externalBookingId || !bookedAt || !totalFare) return show('Fill in Car, Booking ID, Date, and Total Fare', 'error');
    setBusy(true);
    try {
      await fleetApi.addBooking({
        carId, platform, externalBookingId, bookedAt,
        totalFare: Number(totalFare), doorstepCharges: doorstepCharges ? Number(doorstepCharges) : 0,
        platformCommission: platformCommission ? Number(platformCommission) : undefined,
        expectedCreditDate: expectedCreditDate || undefined,
      });
      show('Booking logged', 'success');
      setExternalBookingId(''); setBookedAt(''); setTotalFare(''); setDoorstepCharges(''); setPlatformCommission(''); setExpectedCreditDate('');
      onChange();
    } catch (err: any) {
      show(err.message ?? 'Failed to log booking', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this booking entry?')) return;
    setBusy(true);
    try {
      await fleetApi.deleteBooking(id);
      onChange();
    } catch (err: any) {
      show(err.message ?? 'Failed to delete', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function markReceived(id: string) {
    setBusy(true);
    try {
      await fleetApi.markBookingReceived(id);
      onChange();
    } catch (err: any) {
      show(err.message ?? 'Failed to update', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <Field label="Car"><select value={carId} onChange={(e) => setCarId(e.target.value)} className={`${rowInput} w-full`}><option value="">Select car…</option>{cars.map((c) => <option key={c.id} value={c.id}>{c.make} {c.model} · {c.registrationNo}</option>)}</select></Field>
        <Field label="Platform"><select value={platform} onChange={(e) => setPlatform(e.target.value)} className={`${rowInput} w-full`}>{platforms.map((p) => <option key={p} value={p}>{label(p)}</option>)}</select></Field>
        <Field label="Booking ID"><input value={externalBookingId} onChange={(e) => setExternalBookingId(e.target.value)} placeholder="ZC-BLR-88213" className={`${rowInput} w-full`} /></Field>
        <Field label="Date & Time"><input type="datetime-local" value={bookedAt} onChange={(e) => setBookedAt(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <Field label="Total Fare (₹)"><input type="number" min={0} value={totalFare} onChange={(e) => setTotalFare(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <Field label="Doorstep Charges (₹)"><input type="number" min={0} value={doorstepCharges} onChange={(e) => setDoorstepCharges(e.target.value)} placeholder="0" className={`${rowInput} w-full`} /></Field>
        <Field label="Platform Commission (₹)"><input type="number" min={0} value={platformCommission} onChange={(e) => setPlatformCommission(e.target.value)} placeholder="optional" className={`${rowInput} w-full`} /></Field>
        <Field label="Expected Credit Date"><input type="date" value={expectedCreditDate} onChange={(e) => setExpectedCreditDate(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <button type="submit" disabled={busy} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">Log Booking</button>
      </form>

      <Table
        head={['Car', 'Platform', 'Booking ID', 'Date', 'Fare', 'Doorstep', 'Commission', 'Received', '']}
        rows={rows.map((r) => [
          r.car ? `${r.car.make} ${r.car.model}` : r.carId,
          label(r.platform),
          r.externalBookingId,
          new Date(r.bookedAt).toLocaleString(),
          inr(r.totalFare),
          inr(r.doorstepCharges),
          r.platformCommission ? inr(r.platformCommission) : '—',
          r.received ? (
            <span key="rcv" className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">✓ Received</span>
          ) : (
            <button key="rcv" disabled={busy} onClick={() => markReceived(r.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 hover:border-emerald-500 text-slate-300 hover:text-emerald-400 transition">Mark Received</button>
          ),
          <button key="del" disabled={busy} onClick={() => remove(r.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition">Delete</button>,
        ])}
        empty="No platform bookings logged yet."
      />
    </div>
  );
}

/* ── Journal Entries tab ──────────────────────────────────────────────── */
function JournalTab({ cars, rows, busy, setBusy, onChange, show, categories }: {
  cars: AdminCar[]; rows: JournalEntryRow[]; busy: boolean; setBusy: (b: boolean) => void; onChange: () => void; show: (m: string, t: 'success' | 'error') => void; categories: string[];
}) {
  const [carId, setCarId] = useState('');
  const [collectionDate, setCollectionDate] = useState('');
  const [amountCollected, setAmountCollected] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [category, setCategory] = useState(categories[0] ?? 'FASTAG');
  const [remarks, setRemarks] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!carId || !collectionDate || !amountCollected || !totalAmount) return show('Fill in Car, Date, Amount Collected, and Total Amount', 'error');
    setBusy(true);
    try {
      await fleetApi.addJournalEntry({ carId, collectionDate, amountCollected: Number(amountCollected), totalAmount: Number(totalAmount), category, remarks: remarks || undefined });
      show('Journal entry logged', 'success');
      setCollectionDate(''); setAmountCollected(''); setTotalAmount(''); setRemarks('');
      onChange();
    } catch (err: any) {
      show(err.message ?? 'Failed to log entry', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this journal entry?')) return;
    setBusy(true);
    try {
      await fleetApi.deleteJournalEntry(id);
      onChange();
    } catch (err: any) {
      show(err.message ?? 'Failed to delete', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
        <Field label="Car"><select value={carId} onChange={(e) => setCarId(e.target.value)} className={`${rowInput} w-full`}><option value="">Select car…</option>{cars.map((c) => <option key={c.id} value={c.id}>{c.make} {c.model} · {c.registrationNo}</option>)}</select></Field>
        <Field label="Collection Date"><input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <Field label="Category"><select value={category} onChange={(e) => setCategory(e.target.value)} className={`${rowInput} w-full`}>{categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></Field>
        <Field label="Amount Collected (₹)"><input type="number" min={0} value={amountCollected} onChange={(e) => setAmountCollected(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <Field label="Total Amount (₹)"><input type="number" min={0} value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <Field label="Remarks"><input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="optional" className={`${rowInput} w-full`} /></Field>
        <button type="submit" disabled={busy} className="sm:col-span-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">Log Entry</button>
      </form>

      <Table
        head={['Car', 'Date', 'Category', 'Collected', 'Total', 'Remarks', '']}
        rows={rows.map((r) => [
          r.car ? `${r.car.make} ${r.car.model}` : r.carId,
          new Date(r.collectionDate).toLocaleDateString(),
          label(r.category),
          inr(r.amountCollected),
          inr(r.totalAmount),
          r.remarks ?? '—',
          <button key="del" disabled={busy} onClick={() => remove(r.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition">Delete</button>,
        ])}
        empty="No journal entries logged yet."
      />
    </div>
  );
}

/* ── Expenses tab ─────────────────────────────────────────────────────── */
function ExpensesTab({ cars, rows, busy, setBusy, onChange, show, expenseTypes, paymentModes }: {
  cars: AdminCar[]; rows: FleetExpenseRow[]; busy: boolean; setBusy: (b: boolean) => void; onChange: () => void; show: (m: string, t: 'success' | 'error') => void; expenseTypes: string[]; paymentModes: string[];
}) {
  const [expenseType, setExpenseType] = useState(expenseTypes[0] ?? 'ROUTINE_MAINTENANCE');
  const [carId, setCarId] = useState('');
  const [paymentMode, setPaymentMode] = useState(paymentModes[0] ?? 'CASH');
  const [paidTo, setPaidTo] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !date) return show('Fill in Amount and Date', 'error');
    setBusy(true);
    try {
      await fleetApi.addExpense({ expenseType, carId: carId || undefined, paymentMode, paidTo: paidTo || undefined, amount: Number(amount), date, description: description || undefined });
      show('Expense logged', 'success');
      setAmount(''); setDate(''); setDescription('');
      onChange();
    } catch (err: any) {
      show(err.message ?? 'Failed to log expense', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this expense?')) return;
    setBusy(true);
    try {
      await fleetApi.deleteExpense(id);
      onChange();
    } catch (err: any) {
      show(err.message ?? 'Failed to delete', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
        <Field label="Expense Type"><select value={expenseType} onChange={(e) => setExpenseType(e.target.value)} className={`${rowInput} w-full`}>{expenseTypes.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></Field>
        <Field label="Associated Vehicle"><select value={carId} onChange={(e) => setCarId(e.target.value)} className={`${rowInput} w-full`}><option value="">Fleet-Wide</option>{cars.map((c) => <option key={c.id} value={c.id}>{c.make} {c.model} · {c.registrationNo}</option>)}</select></Field>
        <Field label="Payment Mode"><select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={`${rowInput} w-full`}>{paymentModes.map((m) => <option key={m} value={m}>{label(m)}</option>)}</select></Field>
        <Field label="Paid To"><input value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder="optional — vendor/payee" className={`${rowInput} w-full`} /></Field>
        <Field label="Amount (₹)"><input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${rowInput} w-full`} /></Field>
        <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" className={`${rowInput} w-full`} /></Field>
        <button type="submit" disabled={busy} className="sm:col-span-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">Log Expense</button>
      </form>

      <Table
        head={['Type', 'Vehicle', 'Payment Mode', 'Amount', 'Date', 'Description', '']}
        rows={rows.map((r) => [
          label(r.expenseType),
          r.car ? `${r.car.make} ${r.car.model}` : 'Fleet-Wide',
          label(r.paymentMode),
          inr(r.amount),
          new Date(r.date).toLocaleDateString(),
          r.description ?? '—',
          <button key="del" disabled={busy} onClick={() => remove(r.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition">Delete</button>,
        ])}
        empty="No expenses logged yet."
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-slate-500">{empty}</p>;
  return (
    <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-800">
            {head.map((h) => <th key={h} className="py-3 px-4 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-800/60 last:border-0">
              {row.map((cell, j) => <td key={j} className="py-3 px-4 text-slate-300 whitespace-nowrap">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
