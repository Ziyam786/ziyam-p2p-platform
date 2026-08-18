'use client';

import mixpanel from 'mixpanel-browser';
import type { PublicUser } from './types';

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
export const ANALYTICS_CONSENT_KEY = 'ziyam_analytics_consent';

let initialized = false;

function hasToken(): boolean {
  return Boolean(TOKEN);
}

export type AnalyticsConsent = 'granted' | 'denied' | null;

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  if (value === 'granted' || value === 'denied') return value;
  return null;
}

export function setAnalyticsConsent(value: 'granted' | 'denied'): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  if (value === 'granted') {
    initMixpanel();
  }
}

export function initMixpanel(): void {
  if (typeof window === 'undefined' || initialized || !hasToken()) return;
  if (getAnalyticsConsent() !== 'granted') return;

  mixpanel.init(TOKEN as string, {
    autocapture: true,
    record_sessions_percent: 100,
  });
  mixpanel.register({ platform: 'web' });
  initialized = true;
}

export function identifyMixpanelUser(user: PublicUser): void {
  initMixpanel();
  if (!initialized) return;

  mixpanel.identify(user.id);
  mixpanel.people.set({
    $name: user.fullName,
    $email: user.email,
    role: user.role,
  });
  mixpanel.register({ role: user.role });
}

export function resetMixpanel(): void {
  if (!initialized) return;
  mixpanel.reset();
}

export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean>,
): void {
  initMixpanel();
  if (!initialized) return;

  const payload: Record<string, string | number | boolean> = {};
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      if (value === undefined || value === null || value === '') continue;
      payload[key] = value;
    }
  }
  mixpanel.track(event, payload);
}
