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

/** Sync, zero-bundle-cost check — safe to call at render time. Auth doesn't need the VAPID key (that's push-only). */
export function isFirebaseAuthConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
}

/** Sync, zero-bundle-cost check — safe to call at render time. */
export function isPushConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.storageBucket &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      vapidKey
  );
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
  | { status: 'unconfigured' | 'unsupported' | 'denied' | 'error' }
  | { status: 'granted'; token: string };

/**
 * Registers the browser's service worker, requests notification permission,
 * and returns the FCM device token to save server-side (see
 * usersApi.registerPushToken). Never throws — every failure mode is a
 * status the caller can render around instead of a crash.
 */
export async function setupPushNotifications(): Promise<PushSetupResult> {
  if (!isPushConfigured()) return { status: 'unconfigured' };

  try {
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
  } catch (err) {
    console.error('[PUSH] setupPushNotifications failed:', err);
    return { status: 'error' };
  }
}

export type AppleSignInResult =
  | { status: 'unconfigured' }
  | { status: 'cancelled' }
  | { status: 'error' }
  | { status: 'signed-in'; idToken: string };

/**
 * "Continue with Apple" — a real Firebase Auth popup, hands the resulting
 * ID token back to the caller to POST to /auth/oauth/firebase for
 * verification (see auth.routes.ts). Never throws — 'cancelled' covers the
 * user closing the popup, a normal outcome, not an error to log/alert on.
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  if (!isFirebaseAuthConfigured()) return { status: 'unconfigured' };
  try {
    const [{ getAuth, signInWithPopup, OAuthProvider }, app] = await Promise.all([import('firebase/auth'), getFirebaseApp()]);
    const auth = getAuth(app);
    const provider = new OAuthProvider('apple.com');
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    return { status: 'signed-in', idToken };
  } catch (err: any) {
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      return { status: 'cancelled' };
    }
    console.error('[AUTH] signInWithApple failed:', err);
    return { status: 'error' };
  }
}

/** Foreground push (tab is open/focused) — background pushes are handled by the service worker instead. */
export async function onForegroundPush(callback: (title: string, body: string, link?: string) => void): Promise<() => void> {
  try {
    const messaging = await getMessagingClient();
    if (!messaging) return () => {};
    const { onMessage } = await import('firebase/messaging');
    return onMessage(messaging, (payload) => {
      callback(payload.notification?.title ?? 'Ziyam', payload.notification?.body ?? '', payload.data?.link);
    });
  } catch (err) {
    console.error('[PUSH] onForegroundPush failed:', err);
    return () => {};
  }
}
