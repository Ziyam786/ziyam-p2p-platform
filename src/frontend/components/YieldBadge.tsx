'use client';

import React, { useEffect, useState } from 'react';
import { carsApi } from '../lib/api';
import { useToast } from './Toast';
import type { Car, YieldSuggestion } from '../lib/types';

const TIER_STYLE: Record<YieldSuggestion['tier'], string> = {
  high_demand: 'bg-emerald-500/10 text-emerald-400',
  above_average: 'bg-emerald-500/10 text-emerald-400',
  optimal: 'bg-gray-800 text-gray-400',
  below_average: 'bg-amber-500/10 text-amber-400',
  low_demand: 'bg-red-500/10 text-red-400',
};

// Ziyam Yield — a price suggestion computed from THIS car's own booking
// history (see backend/services/yieldEngine.ts), surfaced right on the
// dashboard row rather than buried in a separate tab. Applying is always an
// explicit click unless the host opts into weekly auto-apply.
export default function YieldBadge({ car, onApplied }: { car: Car; onApplied?: (newRate: number) => void }) {
  const { show } = useToast();
  const [suggestion, setSuggestion] = useState<YieldSuggestion | null>(null);
  const [applying, setApplying] = useState(false);
  const [autoApply, setAutoApply] = useState(car.yieldAutoApply);
  const [togglingAuto, setTogglingAuto] = useState(false);

  useEffect(() => {
    carsApi.yieldSuggestion(car.id).then((res) => setSuggestion(res.data)).catch(() => {});
  }, [car.id]);

  async function apply() {
    setApplying(true);
    try {
      const res = await carsApi.applyYieldSuggestion(car.id);
      show(`Price updated to ₹${res.data.suggestedPrice}/day`, 'success');
      setSuggestion(res.data);
      onApplied?.(res.data.suggestedPrice);
    } catch (err: any) {
      show(err.message ?? 'Failed to apply suggestion', 'error');
    } finally {
      setApplying(false);
    }
  }

  async function toggleAuto() {
    setTogglingAuto(true);
    const next = !autoApply;
    try {
      await carsApi.update(car.id, { yieldAutoApply: next });
      setAutoApply(next);
      show(next ? 'Auto-pricing enabled — adjusts weekly, every Monday' : 'Auto-pricing disabled', 'success');
    } catch (err: any) {
      show(err.message ?? 'Failed to update', 'error');
    } finally {
      setTogglingAuto(false);
    }
  }

  if (!suggestion) return null;
  const noChange = suggestion.suggestedPrice === suggestion.currentPrice;
  const changeLabel = noChange
    ? '📊 Price optimal'
    : suggestion.changePercent > 0
    ? `📈 +${Math.round(suggestion.changePercent * 100)}% suggested`
    : `📉 ${Math.round(suggestion.changePercent * 100)}% suggested`;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${TIER_STYLE[suggestion.tier]}`} title={suggestion.reason}>
        {changeLabel}
      </span>
      {!noChange && (
        <button disabled={applying} onClick={apply} className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline whitespace-nowrap">
          {applying ? 'Applying…' : `Apply ₹${suggestion.suggestedPrice}`}
        </button>
      )}
      <button
        disabled={togglingAuto}
        onClick={toggleAuto}
        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap transition ${
          autoApply ? 'border-emerald-500/50 text-emerald-400' : 'border-gray-700 text-gray-500 hover:text-gray-300'
        }`}
        title={autoApply ? 'Auto-adjusts weekly — click to switch to manual' : 'Click to auto-adjust price weekly'}
      >
        {autoApply ? '⚡ Auto' : 'Auto: off'}
      </button>
    </div>
  );
}
