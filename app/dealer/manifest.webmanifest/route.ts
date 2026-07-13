import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      id: '/dealer',
      name: 'Aim4price Dealer App',
      short_name: 'Dealer',
      description: 'Mobile dealer valuation, discovery, leads and marketplace tools from Aim4price.',
      start_url: '/dealer',
      scope: '/dealer/',
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#f3f8f4',
      theme_color: '#254733',
      categories: ['business', 'productivity'],
      icons: [
        {
          src: '/dealer-icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/dealer-icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/dealer-apple-touch-icon.png',
          sizes: '180x180',
          type: 'image/png',
          purpose: 'any',
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'no-store',
      },
    },
  );
}
