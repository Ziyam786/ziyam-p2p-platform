import { initializeApp, cert, App } from 'firebase-admin';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { config } from '../config';

/**
 * Firebase Admin SDK — used only for FCM push notifications right now (see
 * pushNotificationService.ts). initializeApp/cert/App resolve from the
 * package root fine under this project's tsconfig (moduleResolution:
 * "node"); firebase-admin/messaging is a subpath export that doesn't —
 * see types/firebase-admin-messaging.d.ts for why, same class of issue as
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
