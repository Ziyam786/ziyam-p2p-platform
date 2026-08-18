// Handles push notifications that arrive while no Ziyam tab is focused.
// Foreground pushes (a tab is open) are handled instead by
// lib/firebase.ts's onForegroundPush() — Firebase only calls this worker
// for background/closed-tab delivery.
//
// Static file served from /public — it can't read Next.js env vars at
// request time, so the config below is duplicated from .env.local. This is
// safe: Firebase web config is a public app identifier, not a secret (same
// values already ship inside the client JS bundle). If NEXT_PUBLIC_FIREBASE_*
// changes, update both places.
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCFdTY1jT-2n9y5tkqoYstWfmawCMHRebc',
  authDomain: 'ziyam-11a69.firebaseapp.com',
  projectId: 'ziyam-11a69',
  storageBucket: 'ziyam-11a69.firebasestorage.app',
  messagingSenderId: '41460824985',
  appId: '1:41460824985:web:2868a8b0d8fc8508b5b108',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Ziyam';
  const body = payload.notification?.body ?? '';
  const link = payload.data?.link;
  self.registration.showNotification(title, {
    body,
    icon: '/icon.svg',
    data: { link },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? '/';
  event.waitUntil(clients.openWindow(link));
});
