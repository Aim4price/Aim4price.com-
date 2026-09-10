import AppNotificationsTopLink from '../../components/AppNotificationsTopLink';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  applicationName: 'Aim4price Owner',
  title: 'Aim4price Owner',
  description: 'Mobile owner access to Aim4price assets, attention items, estimates and marketplace.',
  manifest: '/owner-app/manifest.webmanifest?v=2',
  icons: {
    icon: [
      { url: '/owner-app-icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
      { url: '/owner-app-icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/owner-app-apple-icon.png?v=2', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Aim4price Owner', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function OwnerAppLayout({ children }: { children: ReactNode }) {
  return <div data-app-shell="owner" style={{ display: 'contents' }}><AppNotificationsTopLink root="/owner-app" />{children}</div>;
}

