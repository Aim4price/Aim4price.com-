import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Montserrat } from 'next/font/google';
import AppFooter from '../components/AppFooter';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-heading',
});

export const metadata: Metadata = {
  title: {
    default: 'Aim4price - Agricultural & Industrial Machinery Pricing',
    template: '%s | Aim4price',
  },
  description:
    'Discover machinery values, build asset registers, and browse the marketplace from one clear workflow.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable}`}>
      <body>
        <div className="appRoot">
          {children}
          <AppFooter />
        </div>
      </body>
    </html>
  );
}
