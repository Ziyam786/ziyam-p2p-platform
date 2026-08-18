'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import {
  getAnalyticsConsent,
  identifyMixpanelUser,
  initMixpanel,
  resetMixpanel,
  setAnalyticsConsent,
} from '../lib/mixpanel';
import MixpanelConsentBanner from './MixpanelConsentBanner';

export default function MixpanelProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const previousUserId = useRef<string | null>(null);
  const [consent, setConsent] = useState<ReturnType<typeof getAnalyticsConsent>>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(getAnalyticsConsent());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || consent !== 'granted') return;
    initMixpanel();
  }, [ready, consent]);

  useEffect(() => {
    if (loading || !ready || consent !== 'granted') return;

    if (user) {
      identifyMixpanelUser(user);
      previousUserId.current = user.id;
      return;
    }

    if (previousUserId.current) {
      resetMixpanel();
      previousUserId.current = null;
    }
  }, [user, loading, ready, consent]);

  function handleChoice(granted: boolean) {
    const value = granted ? 'granted' : 'denied';
    setAnalyticsConsent(value);
    setConsent(value);
  }

  return (
    <>
      {children}
      {ready && consent === null && <MixpanelConsentBanner onChoice={handleChoice} />}
    </>
  );
}
