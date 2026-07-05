import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Field Manager | Aim4price',
  description: 'Mobile Field Manager access for Aim4price asset updates.',
  manifest: '/field-manager/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Field Manager',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#12352d',
};

export default function FieldManagerLayout({ children }: { children: ReactNode }) {
  return children;
}
