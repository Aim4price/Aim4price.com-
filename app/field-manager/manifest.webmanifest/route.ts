import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      name: 'Aim4price Field Manager',
      short_name: 'Field Manager',
      description: 'Mobile-only Aim4price Field Manager access.',
      id: '/field-manager/login',
      start_url: '/field-manager/login',
      scope: '/field-manager/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#f5f8f5',
      theme_color: '#12352d',
      icons: [
        {
          src: '/icon.png',
          sizes: 'any',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: '/apple-icon.png',
          sizes: '180x180',
          type: 'image/png',
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
