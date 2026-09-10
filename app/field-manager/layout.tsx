import AppNotificationsTopLink from '../../components/AppNotificationsTopLink';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  applicationName: 'Aim4price Farm Manager App',
  title: 'Field Manager | Aim4price',
  description: 'Mobile Field Manager access for Aim4price asset updates.',
  manifest: '/field-manager/manifest.webmanifest?v=3',
  icons: {
    icon: [{ url: '/field-manager-icon.png?v=2', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/field-manager-apple-icon.png?v=2', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Field Manager',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function FieldManagerLayout({ children }: { children: ReactNode }) {
  return <><AppNotificationsTopLink root="/field-manager" />{children}</>;
}

