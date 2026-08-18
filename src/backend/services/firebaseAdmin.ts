import { initializeApp, cert, App } from 'firebase-admin';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, StorageBucket } from 'firebase-admin/storage';
import { config } from '../config';

/**
 * Firebase Admin SDK — FCM push notifications (pushNotificationService.ts),
 * Firebase Auth ID token verification (auth.routes.ts's Apple Sign-In), and
 * Cloud Storage for uploads (upload.routes.ts). initializeApp/cert/App
 * resolve from the package root fine under this project's tsconfig
 * (moduleResolution: "node"); the messaging/auth/storage subpaths don't —
 * see types/firebase-admin-*.d.ts for why, same class of issue as
 * types/supabase-server-core.d.ts.
 */

let app: App | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(config.firebase.serviceAccountJson);
}

function getApp(): App {
  if (app) return app;
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured (FIREBASE_SERVICE_ACCOUNT_JSON is not set)');
  }
  const serviceAccount = JSON.parse(config.firebase.serviceAccountJson);
  app = initializeApp({ credential: cert(serviceAccount) });
  return app;
}

export function getMessagingClient(): Messaging {
  return getMessaging(getApp());
}

export function getAuthClient(): Auth {
  return getAuth(getApp());
}

export function isStorageConfigured(): boolean {
  return isFirebaseConfigured() && Boolean(config.firebase.storageBucket);
}

export function getStorageBucket(): StorageBucket {
  if (!config.firebase.storageBucket) {
    throw new Error('Firebase Storage is not configured (FIREBASE_STORAGE_BUCKET is not set)');
  }
  return getStorage(getApp()).bucket(config.firebase.storageBucket);
}
