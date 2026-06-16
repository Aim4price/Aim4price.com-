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
      { url: '/favicon.ico?v=2', sizes: 'any' },
      { url: '/favicon-32x32.png?v=2', type: 'image/png', sizes: '32x32' },
    ],
    shortcut: ['/favicon.ico?v=2'],
    apple: [{ url: '/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' }],
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
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=2" />
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
