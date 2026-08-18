import type { FirebaseApp } from 'firebase/app';
import type { Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** Sync, zero-bundle-cost check — safe to call at render time. */
export function isPushConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && vapidKey);
}

let appPromise: Promise<FirebaseApp> | null = null;
async function getFirebaseApp(): Promise<FirebaseApp> {
  if (!appPromise) {
    appPromise = import('firebase/app').then(({ initializeApp, getApps, getApp }) =>
      getApps().length ? getApp() : initializeApp(firebaseConfig)
    );
  }
  return appPromise;
}

let messagingPromise: Promise<Messaging | null> | null = null;
async function getMessagingClient(): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const { getMessaging, isSupported } = await import('firebase/messaging');
      // isSupported() rules out Safari/older browsers/non-browser contexts
      // (SSR never reaches here since every caller is 'use client' + useEffect).
      if (!(await isSupported())) return null;
      return getMessaging(await getFirebaseApp());
    })();
  }
  return messagingPromise;
}

export type PushSetupResult =
  | { status: 'unconfigured' | 'unsupported' | 'denied' }
  | { status: 'granted'; token: string };

/**
 * Registers the browser's service worker, requests notification permission,
 * and returns the FCM device token to save server-side (see
 * usersApi.registerPushToken). Never throws — every failure mode is a
 * status the caller can render around instead of a crash.
 */
export async function setupPushNotifications(): Promise<PushSetupResult> {
  if (!isPushConfigured()) return { status: 'unconfigured' };

  const messaging = await getMessagingClient();
  if (!messaging) return { status: 'unsupported' };

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (Notification.permission !== 'granted') return { status: 'denied' };

  const { getToken } = await import('firebase/messaging');
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  return { status: 'granted', token };
}

/** Foreground push (tab is open/focused) — background pushes are handled by the service worker instead. */
export async function onForegroundPush(callback: (title: string, body: string, link?: string) => void): Promise<() => void> {
  const messaging = await getMessagingClient();
  if (!messaging) return () => {};
  const { onMessage } = await import('firebase/messaging');
  return onMessage(messaging, (payload) => {
    callback(payload.notification?.title ?? 'Ziyam', payload.notification?.body ?? '', payload.data?.link);
  });
}
