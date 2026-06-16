import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AppFooter from '../components/AppFooter';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Aim4price - Agricultural & Industrial Machinery Pricing',
    template: '%s | Aim4price',
  },
  description:
    'Discover machinery values, build asset registers, and browse the marketplace from one clear workflow.',
  icons: {
    icon: [
      { url: '/favicon.ico?v=3', sizes: 'any' },
      { url: '/favicon-16x16.png?v=3', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png?v=3', type: 'image/png', sizes: '32x32' },
      { url: '/icon.png?v=3', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: ['/favicon.ico?v=3'],
    apple: [{ url: '/apple-touch-icon.png?v=3', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Montserrat:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="appRoot">
          {children}
          <AppFooter />
        </div>
      </body>
    </html>
  );
}
