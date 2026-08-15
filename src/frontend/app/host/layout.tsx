'use client';

import React from 'react';
import HostBottomNav from '../../components/HostBottomNav';

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-16 sm:pb-0">
      {children}
      <HostBottomNav />
    </div>
  );
}
