import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Aim4price Dealer',
  description: 'Dealer valuation, discovery, leads and marketplace tools from Aim4price.',
  manifest: '/dealer/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.png?v=1', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png?v=1', sizes: '180x180', type: 'image/png' }],
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
  themeColor: '#254733',
};

export default function DealerLayout({ children }: { children: ReactNode }) {
  return children;
}
