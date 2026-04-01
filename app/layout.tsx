import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Aim4price Tractor Valuations',
    template: '%s | Aim4price',
  },
  description:
    'Aim4price tractor valuation prototype with homepage improvements, a cleaner valuation flow, and Railway-friendly deployment settings.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
