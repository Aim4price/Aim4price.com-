import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      id: '/apps/aim4price-dealer',
      name: 'Aim4price Dealer App',
      short_name: 'Dealer',
      description: 'Simple mobile access to leads, maintenance, discovery, estimates, costs and Marketplace.',
      start_url: '/dealer/login?source=dealer-app',
      scope: '/dealer',
      display: 'standalone',
      orientation: 'any',
      background_color: '#ffffff',
      theme_color: '#ffffff',
      categories: ['business', 'productivity'],
      launch_handler: {
        client_mode: 'navigate-new',
      },
      icons: [
        {
          src: '/dealer-icon-192.png?v=3',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/dealer-icon-512.png?v=3',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/dealer-apple-touch-icon.png?v=3',
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
