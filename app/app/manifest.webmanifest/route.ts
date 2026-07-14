import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      id: '/app',
      name: 'Aim4price',
      short_name: 'Aim4price',
      description: 'Your Aim4price assets, values, maintenance and reports in your pocket.',
      start_url: '/app/login?source=aim4price-app',
      scope: '/app',
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#ffffff',
      theme_color: '#ffffff',
      categories: ['business', 'productivity', 'finance'],
      launch_handler: {
        client_mode: 'navigate-existing',
      },
      icons: [
        {
          src: '/icon.png?v=4',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/apple-touch-icon.png?v=4',
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
