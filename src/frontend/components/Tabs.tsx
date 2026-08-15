'use client';

import React from 'react';

interface Tab { key: string; label: string; }

export default function Tabs({
  tabs,
  active,
  onChange,
  variant = 'light',
}: {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  variant?: 'light' | 'dark';
}) {
  const border = variant === 'dark' ? 'border-gray-800' : 'border-gray-200';
  const inactive = variant === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800';

  return (
    <div className={`flex gap-1 border-b ${border} overflow-x-auto`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
            active === tab.key ? 'border-amber-500 text-amber-500' : `border-transparent ${inactive}`
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
