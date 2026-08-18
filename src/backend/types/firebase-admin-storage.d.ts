// firebase-admin/storage is exports-map-only under this project's tsconfig
// (moduleResolution: "node") — same class of issue as
// firebase-admin-messaging.d.ts / firebase-admin-auth.d.ts, same fix: a
// narrow ambient declaration scoped to just what firebaseAdmin.ts calls.
// The real Bucket type (from @google-cloud/storage, a transitive dependency)
// has a much larger surface — this only types the handful of File/Bucket
// methods upload.routes.ts actually uses.
declare module 'firebase-admin/storage' {
  import type { App } from 'firebase-admin';

  export interface SaveOptions {
    contentType?: string;
    public?: boolean;
    metadata?: Record<string, unknown>;
  }

  export interface StorageFile {
    save(data: Buffer, options?: SaveOptions): Promise<void>;
    makePublic(): Promise<unknown>;
    publicUrl(): string;
    exists(): Promise<[boolean]>;
    delete(): Promise<unknown>;
  }

  export interface StorageBucket {
    name: string;
    file(path: string): StorageFile;
  }

  export interface Storage {
    bucket(name?: string): StorageBucket;
  }

  export function getStorage(app?: App): Storage;
}
