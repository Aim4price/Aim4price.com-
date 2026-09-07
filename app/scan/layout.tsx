import type { ReactNode } from 'react';
import type { Viewport } from 'next';

// Preserve the scan workflow's existing viewport when the website root changes.
export const viewport: Viewport = { width: 980, initialScale: -1, userScalable: true };

export default function ScanLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
