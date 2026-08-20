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

/**
 * Bridges the Ziyam JWT session into Firebase Auth — called once per
 * session (see FirebaseAuthBridge.tsx) with a custom token from
 * GET /auth/firebase-custom-token, so Firestore Security Rules can key off
 * request.auth.uid for the real-time listeners below. Never throws.
 */
export async function signInToFirebase(customToken: string): Promise<boolean> {
  if (!isFirebaseAuthConfigured()) return false;
  try {
    const [{ getAuth, signInWithCustomToken }, app] = await Promise.all([import('firebase/auth'), getFirebaseApp()]);
    await signInWithCustomToken(getAuth(app), customToken);
    return true;
  } catch (err) {
    console.error('[AUTH] signInToFirebase failed:', err);
    return false;
  }
}

export interface DeliveryLocationUpdate {
  latitude: number;
  longitude: number;
  updatedAt: string;
  source: 'TELEMATICS' | 'HOST_APP';
}

/**
 * Real-time delivery-location listener — replaces the old 8s poll of
 * GET /bookings/:id/delivery-location. Falls back to null (caller should
 * keep polling) if Firebase isn't configured, so this never breaks
 * delivery tracking for a deployment without Firebase set up.
 */
export async function subscribeToDeliveryLocation(
  bookingId: string,
  callback: (update: DeliveryLocationUpdate | null) => void
): Promise<(() => void) | null> {
  if (!isFirebaseAuthConfigured()) return null;
  try {
    const [{ getFirestore, doc, onSnapshot }, app] = await Promise.all([import('firebase/firestore'), getFirebaseApp()]);
    const ref = doc(getFirestore(app), 'deliveryTracking', bookingId);
    return onSnapshot(
      ref,
      (snap) => callback(snap.exists() ? (snap.data() as DeliveryLocationUpdate) : null),
      (err) => console.error('[FIRESTORE] delivery-location listener failed:', err)
    );
  } catch (err) {
    console.error('[FIRESTORE] subscribeToDeliveryLocation setup failed:', err);
    return null;
  }
}

export interface TripChatMessageUpdate {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
}

/**
 * Real-time trip-chat listener — replaces the old 8s poll of
 * GET /bookings/:id/messages. Falls back to null (caller should keep
 * polling) if Firebase isn't configured.
 */
export async function subscribeToTripChat(
  bookingId: string,
  callback: (messages: TripChatMessageUpdate[]) => void
): Promise<(() => void) | null> {
  if (!isFirebaseAuthConfigured()) return null;
  try {
    const [{ getFirestore, collection, query, orderBy, onSnapshot }, app] = await Promise.all([import('firebase/firestore'), getFirebaseApp()]);
    const q = query(collection(getFirestore(app), `tripChats/${bookingId}/messages`), orderBy('createdAt', 'asc'));
    return onSnapshot(
      q,
      (snap) => callback(snap.docs.map((d) => d.data() as TripChatMessageUpdate)),
      (err) => console.error('[FIRESTORE] trip-chat listener failed:', err)
    );
  } catch (err) {
    console.error('[FIRESTORE] subscribeToTripChat setup failed:', err);
    return null;
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

