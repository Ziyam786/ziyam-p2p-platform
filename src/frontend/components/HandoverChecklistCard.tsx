import React from 'react';

interface ChecklistItem {
  label: string;
  done: boolean;
}

/** Summarizes the pickup/return proof already collected elsewhere on this page (condition photos, handover OTPs) as one glanceable checklist, rather than inventing new fields to track. */
export default function HandoverChecklistCard({ items }: { items: ChecklistItem[] }) {
  return (
    <div className="mt-6 bg-gray-50 border border-gray-100 rounded-xl p-5">
      <p className="text-sm font-bold text-gray-800 mb-3">Handover checklist</p>
      <div className="flex flex-col gap-2 text-sm">
        {items.map((item) => (
          <div key={item.label} className={item.done ? 'text-gray-700' : 'text-gray-400'}>
            {item.done ? '✅' : '◻'} {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
