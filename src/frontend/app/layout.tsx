import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZiyamSelfDrive — India's P2P Self-Drive Car Rental',
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
