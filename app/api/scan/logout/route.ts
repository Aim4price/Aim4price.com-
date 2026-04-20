import { NextResponse } from 'next/server';
import { clearScanSessionCookie } from '../../../../lib/scan-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearScanSessionCookie(response);
  return response;
}
