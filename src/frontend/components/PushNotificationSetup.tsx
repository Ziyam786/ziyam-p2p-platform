'use client';

import { useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { usersApi } from '../lib/api';
import { isPushConfigured, setupPushNotifications, onForegroundPush } from '../lib/firebase';
import { useToast } from './Toast';

const REGISTERED_TOKEN_KEY = 'ziyam_push_token';

/**
 * Silent — no UI of its own. Once a guest/host is signed in, quietly asks
 * the browser for notification permission (only if the browser hasn't
 * already decided default/denied on a previous visit — no repeat prompting)
 * and registers the resulting FCM token so notify() (backend) can reach
 * this device. Mounted once from RootLayout, inside AuthProvider.
 */
export default function PushNotificationSetup() {
  const { user } = useAuth();
  const { show } = useToast();

  useEffect(() => {
    if (!user || !isPushConfigured()) return;
    if (typeof Notification === 'undefined' || Notification.permission === 'denied') return;

    let cancelled = false;
    setupPushNotifications()
      .then((result) => {
        if (cancelled || result.status !== 'granted') return;
        if (localStorage.getItem(REGISTERED_TOKEN_KEY) === result.token) return;
        usersApi
          .registerPushToken(result.token, 'web')
          .then(() => localStorage.setItem(REGISTERED_TOKEN_KEY, result.token))
          .catch((err) => console.error('[PUSH] Failed to register token:', err));
      })
      .catch((err) => console.error('[PUSH] Setup failed:', err));

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !isPushConfigured()) return;
    let unsubscribe: (() => void) | undefined;
    onForegroundPush((title, body) => {
      show(`${title} — ${body}`, 'info');
    })
      .then((fn) => {
        unsubscribe = fn;
      })
      .catch((err) => console.error('[PUSH] Foreground listener failed:', err));
    return () => unsubscribe?.();
  }, [user, show]);

  return null;
}
