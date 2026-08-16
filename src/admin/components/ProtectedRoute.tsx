'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import LoadingScreen from './LoadingScreen';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    // Agents only ever see the /agent portal, never the full admin dashboard/nav.
    if (user.role === 'AGENT' && !pathname?.startsWith('/agent')) {
      router.replace('/agent');
    }
  }, [loading, user, router, pathname]);

  if (loading || !user || (user.role === 'AGENT' && !pathname?.startsWith('/agent'))) {
    return <LoadingScreen label="Loading control panel…" />;
  }

  return <>{children}</>;
}
