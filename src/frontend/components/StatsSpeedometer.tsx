'use client';

import React, { useState } from 'react';

export interface SpeedoStat {
  value: string;
  percent: number; // 0–1, how far the needle sweeps
  label: string;
}

export default function StatsSpeedometer({ stats }: { stats: SpeedoStat[] }) {
  const [active, setActive] = useState(0);
  const stat = stats[active];
  const needleDeg = -90 + Math.max(0, Math.min(1, stat.percent)) * 180;

  function go(delta: number) {
    setActive((i) => (i + delta + stats.length) % stats.length);
  }

  return (
    <div className="relative bg-gray-950 rounded-[2.5rem] border border-gray-800 overflow-hidden py-14 px-6">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <button
        onClick={() => go(-1)}
        aria-label="Previous stat"
        className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gray-900 border border-gray-800 text-gray-400 hover:text-amber-400 hover:border-amber-500/50 flex items-center justify-center transition z-10"
      >
        ‹
      </button>
      <button
        onClick={() => go(1)}
        aria-label="Next stat"
        className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-gray-900 border border-gray-800 text-gray-400 hover:text-amber-400 hover:border-amber-500/50 flex items-center justify-center transition z-10"
      >
        ›
      </button>

      <div className="relative flex flex-col items-center">
        <svg width="220" height="130" viewBox="0 0 220 130" className="mb-2">
          <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="#1f2937" strokeWidth="10" strokeLinecap="round" />
          <path
            d="M 20 110 A 90 90 0 0 1 200 110"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${stat.percent * 283} 283`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
          <g style={{ transform: `rotate(${needleDeg}deg)`, transformOrigin: '110px 110px', transition: 'transform 0.6s cubic-bezier(0.4,0,0.2,1)' }}>
            <line x1="110" y1="110" x2="110" y2="35" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
          </g>
          <circle cx="110" cy="110" r="8" fill="#f59e0b" />
        </svg>

        <div className="text-3xl font-extrabold text-amber-400">{stat.value}</div>
        <div className="text-xs text-gray-400 uppercase tracking-widest mt-1">{stat.label}</div>

        <div className="flex gap-2 mt-8">
          {stats.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setActive(i)}
              aria-label={`Show ${s.label}`}
              className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-amber-500' : 'w-1.5 bg-gray-700 hover:bg-gray-600'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
