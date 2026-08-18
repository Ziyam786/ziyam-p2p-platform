import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth-context';
import { WishlistProvider } from '../lib/wishlist-context';
import { ToastProvider } from '../components/Toast';
import ChatWidget from '../components/ChatWidget';
import PushNotificationSetup from '../components/PushNotificationSetup';
import FirebaseAuthBridge from '../components/FirebaseAuthBridge';

export const metadata: Metadata = {
  title: "ZiyamSelfDrive — India's P2P Self-Drive Car Rental",
  description:
    'Rent verified self-drive cars from trusted hosts in Bengaluru. No driver. No hassle. Just open roads.',
  keywords: ['self-drive car rental', 'p2p car rental', 'bengaluru car rental', 'ziyam selfdrive'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <WishlistProvider>
            <ToastProvider>
              {children}
              <ChatWidget />
              <PushNotificationSetup />
              <FirebaseAuthBridge />
            </ToastProvider>
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
