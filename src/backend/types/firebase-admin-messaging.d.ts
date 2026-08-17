// firebase-admin/messaging is exports-map-only under this project's tsconfig
// (moduleResolution: "node") — same class of issue as
// supabase-server-core.d.ts, same fix: a narrow ambient declaration scoped
// to just what pushNotificationService.ts actually calls.
declare module 'firebase-admin/messaging' {
  // App is available from the package root (firebase-admin/lib/app/core is
  // re-exported at ".") — importing from there instead of the "firebase-admin/app"
  // subpath avoids needing a second ambient declaration for that path too.
  import type { App } from 'firebase-admin';

  export interface MulticastMessage {
    tokens: string[];
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
    webpush?: { fcmOptions?: { link?: string } };
  }

  export interface SendResponse {
    success: boolean;
    messageId?: string;
    error?: { code?: string; message?: string };
  }

  export interface BatchResponse {
    responses: SendResponse[];
    successCount: number;
    failureCount: number;
  }

  export interface Messaging {
    sendEachForMulticast(message: MulticastMessage, dryRun?: boolean): Promise<BatchResponse>;
  }

  export function getMessaging(app?: App): Messaging;
}
