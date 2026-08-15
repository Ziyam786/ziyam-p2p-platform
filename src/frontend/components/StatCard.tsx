import React from 'react';

export default function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: 'positive' | 'negative' | 'warning';
}) {
  const toneClasses = {
    positive: 'border-emerald-500/30 bg-emerald-950/10 text-emerald-400',
    negative: 'text-red-400',
    warning: 'border-amber-500/30 bg-amber-950/10 text-amber-400',
  };
  const cardTone = tone === 'positive' || tone === 'warning' ? toneClasses[tone] : '';
  const valueTone = tone ? toneClasses[tone].split(' ').filter((c) => c.startsWith('text-'))[0] : '';

  return (
    <div className={`bg-gray-900 border border-gray-800 p-6 rounded-xl ${cardTone}`}>
      <p className="text-gray-400 text-sm">{label}</p>
      <h2 className={`text-3xl font-extrabold mt-2 ${valueTone}`}>
        {value < 0 ? '-' : ''}₹{Math.abs(value).toLocaleString()}
      </h2>
      <span className="text-xs text-gray-500">{sub}</span>
    </div>
  );
}
