import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  applicationName: 'Aim4price Dealer App',
  title: 'Aim4price Dealer',
  description: 'Dealer valuation, discovery, leads and marketplace tools from Aim4price.',
  manifest: '/dealer/manifest.webmanifest?v=4',
  icons: {
    icon: [
      { url: '/dealer-icon-192.png?v=3', sizes: '192x192', type: 'image/png' },
      { url: '/dealer-icon-512.png?v=3', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/dealer-apple-touch-icon.png?v=3', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Dealer',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function DealerLayout({ children }: { children: ReactNode }) {
  return children;
}
