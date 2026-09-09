import type { Metadata } from 'next';

export const middlemanAppMetadata: Metadata = {
  applicationName: 'Aim4price Middleman App',
  title: 'Aim4price Middleman',
  description: 'Get estimates, discover assets, browse Marketplace and manage adverts and your showroom.',
  manifest: '/dealer/manifest.webmanifest?app=middleman&v=1',
  icons: {
    icon: [
      { url: '/middleman-icon-192.png?v=1', sizes: '192x192', type: 'image/png' },
      { url: '/middleman-icon-512.png?v=1', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/middleman-apple-touch-icon.png?v=1', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Middleman', statusBarStyle: 'default' },
};
