import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import AdminWorkTrackerBar from '../components/AdminWorkTrackerBar';
import AppFooter from '../components/AppFooter';
import AppPatternBackground from '../components/AppPatternBackground';
import MobileOrientationPrompt from '../components/MobileOrientationPrompt';
import './globals.css';

const brandTitle = 'Aim4price | Asset Intelligence, Management & Pricing';
const brandDescription =
  'Asset intelligence, management and pricing for South African assets. Value, record, manage and share machinery, vehicles, equipment and property in one connected system.';

export const metadata: Metadata = {
  title: {
    default: brandTitle,
    template: '%s | Aim4price',
  },
  description: brandDescription,
  applicationName: 'Aim4price',
  openGraph: {
    type: 'website',
    siteName: 'Aim4price',
    title: brandTitle,
    description: brandDescription,
  },
  twitter: {
    card: 'summary',
    title: brandTitle,
    description: brandDescription,
  },
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

export const viewport: Viewport = {
  // Keep normal website routes on a strict desktop canvas and let mobile
  // browsers shrink the complete 980px layout to fit the physical screen.
  // The installable apps override this in their nested layouts.
  width: 980,
  initialScale: -1,
  userScalable: true,
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
        <MobileOrientationPrompt />
        <div className="appRoot">
          <AppPatternBackground>{children}</AppPatternBackground>
          <AdminWorkTrackerBar />
          <AppFooter />
        </div>
      </body>
    </html>
  );
}
