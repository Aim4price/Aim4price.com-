import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request?: Request) {
  const middleman = new URL(request?.url || 'https://www.aim4price.com/dealer/manifest.webmanifest').searchParams.get('app') === 'middleman';
  return NextResponse.json(
    {
      id: middleman ? '/apps/aim4price-middleman' : '/apps/aim4price-dealer',
      name: middleman ? 'Aim4price Middleman App' : 'Aim4price Dealer App',
      short_name: middleman ? 'Middleman' : 'Dealer',
      description: middleman ? 'Estimates, discovery, Marketplace, Ad Studio and showroom.' : 'Simple mobile access to leads, maintenance, discovery, estimates and Marketplace.',
      start_url: middleman ? '/dealer/login?app=middleman&source=middleman-app' : '/dealer/login?source=dealer-app',
      scope: '/dealer',
      display: 'standalone',
      orientation: 'any',
      background_color: middleman ? '#1877F2' : '#103f34',
      theme_color: '#103f34',
      ...(middleman ? { theme_color: '#1877F2' } : {}),
      categories: ['business', 'productivity'],
      launch_handler: {
        client_mode: 'navigate-new',
      },
      icons: [
        {
          src: middleman ? '/middleman-icon-192.png?v=1' : '/dealer-icon-192-dark.png?v=1',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: middleman ? '/middleman-icon-512.png?v=1' : '/dealer-icon-512-dark.png?v=1',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: middleman ? '/middleman-apple-touch-icon.png?v=1' : '/dealer-apple-touch-icon-dark.png?v=1',
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

