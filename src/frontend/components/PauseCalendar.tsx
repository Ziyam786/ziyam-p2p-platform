'use client';

import React, { useMemo } from 'react';
import type { Blackout } from '../lib/types';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toISODate(d: Date) {
  return startOfDay(d).toISOString().slice(0, 10);
}

function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function PauseCalendar({
  blackouts,
  rangeStart,
  rangeEnd,
  onPickDate,
  monthsAhead = 3,
}: {
  blackouts: Blackout[];
  rangeStart: string | null;
  rangeEnd: string | null;
  onPickDate: (isoDate: string) => void;
  monthsAhead?: number;
}) {
  const today = startOfDay(new Date());

  const pausedDates = useMemo(() => {
    const set = new Set<string>();
    blackouts.forEach((b) => {
      const start = startOfDay(new Date(b.startDate));
      const end = startOfDay(new Date(b.endDate));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        set.add(toISODate(d));
      }
    });
    return set;
  }, [blackouts]);

  const months = useMemo(() => {
    const list: { year: number; month: number }[] = [];
    for (let i = 0; i < monthsAhead; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      list.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return list;
  }, [monthsAhead, today]);

  return (
    <div className="space-y-6 max-h-96 overflow-y-auto pr-1">
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> Your Pause</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Selected</span>
      </div>

      {months.map(({ year, month }) => {
        const weeks = buildMonthGrid(year, month);
        const label = new Date(year, month, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

        return (
          <div key={`${year}-${month}`}>
            <p className="text-sm font-bold text-gray-800 mb-2">{label}</p>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {WEEKDAYS.map((w, i) => (
                <span key={`${w}-${i}`} className="text-[10px] font-bold text-gray-400">{w}</span>
              ))}
              {weeks.flat().map((date, i) => {
                if (!date) return <span key={i} />;
                const iso = toISODate(date);
                const isPast = date < today;
                const isPaused = pausedDates.has(iso);
                const isRangeStart = rangeStart === iso;
                const isRangeEnd = rangeEnd === iso;
                const inSelectedRange = rangeStart && rangeEnd && iso >= rangeStart && iso <= rangeEnd;
                const isSelected = isRangeStart || isRangeEnd || inSelectedRange;

                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={isPast}
                    onClick={() => onPickDate(iso)}
                    className={`relative text-xs py-2 rounded-lg transition ${
                      isPast ? 'text-gray-300 line-through cursor-not-allowed'
                      : isSelected ? 'bg-amber-400 text-white font-bold'
                      : 'text-gray-700 hover:bg-amber-50'
                    }`}
                  >
                    {date.getDate()}
                    {isPaused && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gray-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
