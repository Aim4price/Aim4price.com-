import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  applicationName: 'Aim4price Owner',
  title: 'Aim4price Owner',
  description: 'Mobile owner access to Aim4price assets, attention items, estimates and marketplace.',
  manifest: '/owner-app/manifest.webmanifest?v=1',
  icons: {
    icon: [
      { url: '/owner-app-icon-192.png?v=1', sizes: '192x192', type: 'image/png' },
      { url: '/owner-app-icon-512.png?v=1', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/owner-app-apple-icon.png?v=1', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Aim4price Owner', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function OwnerAppLayout({ children }: { children: ReactNode }) {
  return children;
}
