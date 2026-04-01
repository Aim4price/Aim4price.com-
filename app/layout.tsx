import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Aim4price – Agricultural & Industrial Machinery Pricing',
    template: '%s | Aim4price',
  },
  description:
    'Build asset registers, determine true machinery values, and buy or sell with confidence — all on one easy-to-use platform.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
