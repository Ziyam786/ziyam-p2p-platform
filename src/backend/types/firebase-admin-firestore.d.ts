// firebase-admin/firestore is exports-map-only under this project's tsconfig
// (moduleResolution: "node") — same class of issue as the other
// firebase-admin-*.d.ts files. Only types the handful of methods
// booking.routes.ts actually calls (set on a doc/subcollection ref),
// not the full Firestore SDK surface.
declare module 'firebase-admin/firestore' {
  import type { App } from 'firebase-admin';

  export interface DocumentReference {
    set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
    collection(path: string): CollectionReference;
  }

  export interface CollectionReference {
    doc(path?: string): DocumentReference;
  }

  export interface Firestore {
    collection(path: string): CollectionReference;
  }

  export function getFirestore(app?: App): Firestore;
  export const FieldValue: {
    serverTimestamp(): unknown;
  };
}
