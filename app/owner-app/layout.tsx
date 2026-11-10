import flowStyles from '../../components/app-flow.module.css';
import OwnerBottomNav from './owner-bottom-nav';
import AppOfflineEntry from '../../components/AppOfflineEntry';
import AppSessionKeeper from '../app-session-keeper';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import styles from './owner-app.module.css';

export const metadata: Metadata = {
  applicationName: 'Aim4price Manager',
  title: 'Aim4price Manager',
  description: 'Mobile owner access to Aim4price assets, attention items, estimates and marketplace.',
  manifest: '/owner-app/manifest.webmanifest?v=2',
  icons: {
    icon: [
      { url: '/owner-app-icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
      { url: '/owner-app-icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/owner-app-apple-icon.png?v=2', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Aim4price Manager', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#f6faf7',
};

export default function OwnerAppLayout({ children }: { children: ReactNode }) {
  return <div data-app-shell="owner" className={`${styles.appShell} ${flowStyles.surface}`} style={{ display: 'contents' }}><AppSessionKeeper appRoot="/owner-app" /><AppOfflineEntry appRoot="/owner-app" worker="/owner-app-sw.js" />{children}<OwnerBottomNav /></div>;
}

