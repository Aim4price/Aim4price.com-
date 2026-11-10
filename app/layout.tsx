import { DesktopWorkspaceProvider } from '../components/DesktopWorkspace';
import { getDesktopScope, desktopWorkspace } from '../lib/desktop-workspace';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { APP_REQUEST_CONTEXT_SCRIPT } from '../lib/app-request-context';
import AdminWorkTrackerBar from '../components/AdminWorkTrackerBar';
import AppFooter from '../components/AppFooter';
import AppPatternBackground from '../components/AppPatternBackground';
import SiteWorkspaceZoom from '../components/SiteWorkspaceZoom';
import { BACKGROUND_PREFERENCE_SCRIPT } from '../lib/background-preference';
import { APP_THEME_SCRIPT } from '../lib/app-theme';
import AppThemeSync from '../components/AppThemeSync';
import HoverLabels from '../components/HoverLabels';
import ScrollbarInteractionGuard from '../components/ScrollbarInteractionGuard';
import './globals.css';
import './modal-close.css';
import './hover-labels.css';
import '../public/app-theme.css';
import './asset-register-view-tuning.css';

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
  width: 'device-width',
  initialScale: 1,
  userScalable: true,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const desktop = await getDesktopScope().catch(() => null);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BACKGROUND_PREFERENCE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: APP_THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: APP_REQUEST_CONTEXT_SCRIPT }} />
        <link
          rel="preload"
          href="/fonts/montserrat-latin.woff"
          as="font"
          type="font/woff"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ScrollbarInteractionGuard />
        <AppThemeSync />
        <HoverLabels />
        <div className="appRoot">
          <SiteWorkspaceZoom footer={<AppFooter />} operational={<AdminWorkTrackerBar />}>
            <DesktopWorkspaceProvider workspace={desktop ? desktopWorkspace(desktop) : null}><AppPatternBackground>{children}</AppPatternBackground></DesktopWorkspaceProvider>
          </SiteWorkspaceZoom>
        </div>
      </body>
    </html>
  );
}

