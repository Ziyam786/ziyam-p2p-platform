'use client';

import React, { useEffect, useState } from 'react';

const TICK_MS = 30000;

function formatDuration(ms: number) {
  const totalMinutes = Math.round(Math.abs(ms) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/** Live-ticking "time until return due" card for an ACTIVE trip — turns red and switches to "Overdue by" once endTime has passed. */
export default function TripCountdownCard({ endTime }: { endTime: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const diff = new Date(endTime).getTime() - now;
  const overdue = diff < 0;

  return (
    <div className={`mt-6 rounded-xl p-5 border ${overdue ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
      <p className={`text-2xl font-extrabold ${overdue ? 'text-red-600' : 'text-gray-900'}`}>{formatDuration(diff)}</p>
      <p className={`text-xs font-semibold mt-1 ${overdue ? 'text-red-500' : 'text-gray-500'}`}>
        {overdue ? 'overdue for return' : 'until return due'}
      </p>
    </div>
  );
}
