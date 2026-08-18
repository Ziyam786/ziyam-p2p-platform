// firebase-admin/auth is exports-map-only under this project's tsconfig
// (moduleResolution: "node") — same class of issue as
// firebase-admin-messaging.d.ts, same fix: a narrow ambient declaration
// scoped to just what firebaseAdmin.ts actually calls.
declare module 'firebase-admin/auth' {
  import type { App } from 'firebase-admin';

  export interface DecodedIdToken {
    uid: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    [key: string]: unknown;
  }

  export interface Auth {
    verifyIdToken(idToken: string, checkRevoked?: boolean): Promise<DecodedIdToken>;
    createCustomToken(uid: string, developerClaims?: Record<string, unknown>): Promise<string>;
  }

  export function getAuth(app?: App): Auth;
}
