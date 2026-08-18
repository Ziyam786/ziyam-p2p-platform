'use client';

import mixpanel from 'mixpanel-browser';
import type { PublicUser } from './types';

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;

function hasToken(): boolean {
  return Boolean(TOKEN);
}

export function initMixpanel(): void {
  if (typeof window === 'undefined' || initialized || !hasToken()) return;

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
