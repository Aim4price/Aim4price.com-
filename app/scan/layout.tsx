import type { ReactNode } from 'react';
import type { Viewport } from 'next';

// Public scans use the same native viewport as the mobile apps.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, userScalable: true, viewportFit: 'cover' };

export default function ScanLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
