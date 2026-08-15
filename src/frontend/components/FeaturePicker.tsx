'use client';

import React from 'react';

export const FEATURE_CATALOG: Record<string, { icon: string; label: string }[]> = {
  Driving: [
    { icon: '🪟', label: 'Power Windows' },
    { icon: '🎡', label: 'Power Steering' },
    { icon: '❄️', label: 'Air Conditioning' },
    { icon: '☀️', label: 'Sun Roof' },
    { icon: '🧳', label: 'Carrier on Top' },
    { icon: '🧰', label: 'Full Boot Space' },
    { icon: '🔑', label: 'Keyless Entry' },
    { icon: '▶️', label: 'Push Button Start' },
    { icon: '🎚️', label: 'Cruise Control' },
    { icon: '🌤️', label: 'Panoramic Sunroof' },
    { icon: '🎙️', label: 'Voice Control' },
    { icon: '💨', label: 'Air Purifier' },
  ],
  Entertainment: [
    { icon: '🎵', label: 'Music System' },
    { icon: '🌸', label: 'Air Freshener' },
    { icon: '🔌', label: 'Aux Input' },
    { icon: '🎧', label: 'Aux Cable' },
    { icon: '📶', label: 'Bluetooth' },
    { icon: '🔋', label: 'USB Charger' },
    { icon: '🌬️', label: 'Ventilated Seats' },
  ],
  Safety: [
    { icon: '🛞', label: 'Spare Wheel' },
    { icon: '🛞', label: 'Spare Tyre' },
    { icon: '🧰', label: 'ToolKit' },
    { icon: '📷', label: 'Reverse Camera' },
    { icon: '🍼', label: 'Child Seat' },
    { icon: '🐾', label: 'Pet Friendly' },
    { icon: '🪞', label: 'Electronic ORVM' },
    { icon: '🛡️', label: 'ADAS' },
    { icon: '🅰️', label: 'Anti-lock Braking System' },
    { icon: '⚙️', label: 'Traction Control' },
    { icon: '📹', label: '360 View Camera' },
    { icon: '🎈', label: '2 Side Airbags' },
    { icon: '🎈', label: '2 Rear Airbags' },
  ],
};

export default function FeaturePicker({
  selected,
  onChange,
  minRequired = 5,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  minRequired?: number;
}) {
  function toggle(label: string) {
    onChange(selected.includes(label) ? selected.filter((f) => f !== label) : [...selected, label]);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Choose at least {minRequired} features
        <span className={selected.length >= minRequired ? 'text-emerald-500 font-semibold ml-2' : 'text-amber-500 font-semibold ml-2'}>
          ({selected.length} selected)
        </span>
      </p>
      {Object.entries(FEATURE_CATALOG).map(([category, items]) => (
        <div key={category}>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{category}</h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {items.map((item) => {
              const active = selected.includes(item.label);
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => toggle(item.label)}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition ${
                    active ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
