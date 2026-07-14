import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import OwnerAppStandaloneGate from './owner-app-standalone-gate';

export const metadata: Metadata = {
  applicationName: 'Aim4price',
  title: 'Aim4price App',
  description: 'Your assets, values, maintenance and reports in your pocket.',
  manifest: '/app/manifest.webmanifest?v=1',
  icons: {
    icon: [{ url: '/icon.png?v=4', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png?v=4', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Aim4price',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function OwnerAppLayout({ children }: { children: ReactNode }) {
  return <OwnerAppStandaloneGate>{children}</OwnerAppStandaloneGate>;
}
