'use client';

import { useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { authApi } from '../lib/api';
import { isFirebaseAuthConfigured, signInToFirebase } from '../lib/firebase';

/**
 * Silent — no UI of its own. Once a guest/host is signed in, quietly signs
 * them into Firebase Auth too (via a custom token minted from their Ziyam
 * session) so Firestore Security Rules can restrict the real-time
 * delivery-tracking/trip-chat listeners to a booking's actual participants.
 * Mounted once from RootLayout, inside AuthProvider. If this never runs
 * (Firebase unconfigured, or the token mint fails), LiveDeliveryTracker/
 * TripChat just keep using their polling fallback — nothing else depends
 * on this succeeding.
 */
export default function FirebaseAuthBridge() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isFirebaseAuthConfigured()) return;
    let cancelled = false;
    authApi
      .firebaseCustomToken()
      .then((res) => {
        if (!cancelled) return signInToFirebase(res.data.token);
      })
      .catch((err) => console.error('[FIREBASE BRIDGE] Failed to sign in:', err));
    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
}
