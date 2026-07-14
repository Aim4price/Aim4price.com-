import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    id: '/apps/aim4price-owner',
    name: 'Aim4price Owner',
    short_name: 'Owner',
    description: 'Mobile owner access to Aim4price assets, attention items, estimates and marketplace.',
    start_url: '/owner-app/login?source=owner-app',
    scope: '/owner-app',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    categories: ['business', 'productivity'],
    launch_handler: { client_mode: 'navigate-new' },
    icons: [
      { src: '/owner-app-icon-192.png?v=1', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/owner-app-icon-512.png?v=1', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: '/owner-app-apple-icon.png?v=1', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } });
}
