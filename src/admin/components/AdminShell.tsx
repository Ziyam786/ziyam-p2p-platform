'use client';

import React from 'react';
import ProtectedRoute from './ProtectedRoute';
import Sidebar from './Sidebar';

export default function AdminShell({ title, subtitle, action, children }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <header className="px-8 py-6 border-b border-slate-800 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">{title}</h1>
              {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            {action}
          </header>
          <div className="p-8">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
