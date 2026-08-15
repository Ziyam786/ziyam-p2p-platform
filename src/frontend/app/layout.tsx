import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth-context';
import { WishlistProvider } from '../lib/wishlist-context';
import { ToastProvider } from '../components/Toast';
import ChatWidget from '../components/ChatWidget';
import CustomCursor from '../components/CustomCursor';

export const metadata: Metadata = {
  title: "ZiyamSelfDrive — India's P2P Self-Drive Car Rental",
  description:
    'Rent verified self-drive cars from trusted hosts across 30+ Indian cities. No driver. No hassle. Just open roads.',
  keywords: ['self-drive car rental', 'p2p car rental', 'zoomcar alternative', 'india car rental'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <WishlistProvider>
            <ToastProvider>
              {children}
              <ChatWidget />
              <CustomCursor />
            </ToastProvider>
          </WishlistProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
