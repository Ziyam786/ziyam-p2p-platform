'use client';

import React from 'react';

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto text-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none" aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
