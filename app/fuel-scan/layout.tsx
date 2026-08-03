import type { Viewport } from 'next';
import type { ReactNode } from 'react';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: true,
};

export default function FuelScanLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
