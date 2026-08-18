'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth-context';
import { identifyMixpanelUser, initMixpanel, resetMixpanel } from '../lib/mixpanel';

export default function MixpanelProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    initMixpanel();
  }, []);

  useEffect(() => {
    if (loading) return;

    if (user) {
      identifyMixpanelUser(user);
      previousUserId.current = user.id;
      return;
    }

    if (previousUserId.current) {
      resetMixpanel();
      previousUserId.current = null;
    }
  }, [user, loading]);

  return <>{children}</>;
}
