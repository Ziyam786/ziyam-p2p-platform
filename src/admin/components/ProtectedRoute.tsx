'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import LoadingScreen from './LoadingScreen';

// Roles restricted to a single section, never the full admin dashboard/nav —
// FLEET_ADMIN is deliberately excluded (full access, same as ADMIN), since
// they administer the whole Fleet Ops Dashboard rather than one job function.
// This is a coarse stand-in for real per-screen enforcement until the
// CustomRole "Who Can Do What" permission layer is wired into routing.
const RESTRICTED_HOME: Record<string, string> = {
  AGENT: '/agent',
  OPERATIONS_EXECUTIVE: '/ops-trips',
  MECHANICAL_EXECUTIVE: '/ops-trips',
  TECHNICIAN: '/ops-trips',
};

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const home = user ? RESTRICTED_HOME[user.role] : undefined;
  const outOfBounds = Boolean(home && !pathname?.startsWith(home));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (outOfBounds && home) router.replace(home);
  }, [loading, user, router, outOfBounds, home]);

  if (loading || !user || outOfBounds) {
    return <LoadingScreen label="Loading control panel…" />;
  }

  return <>{children}</>;
}
