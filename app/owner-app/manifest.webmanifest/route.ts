import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    id: '/apps/aim4price-owner',
    name: 'Aim4price Manager',
    short_name: 'Manager',
    description: 'Manage assets, work, fuel and records with access controlled by your account holder.',
    start_url: '/owner-app/login?source=owner-app',
    scope: '/owner-app',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f6faf7',
    theme_color: '#f6faf7',
    categories: ['business', 'productivity'],
    launch_handler: { client_mode: 'navigate-new' },
    icons: [
      { src: '/owner-app-icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/owner-app-icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: '/owner-app-apple-icon.png?v=2', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } });
}
