import { NextResponse } from 'next/server';
import { resolveOwnerWorkspaceContext } from '../../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Authenticated compatibility response for clients using the old fuel reader. */
export async function POST(request: Request) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;

  return NextResponse.json(
    {
      ok: false,
      error: 'Automatic fuel-slip reading has been retired. Send the slip for Aim4price capture instead.',
      captureEndpoint: '/api/capture-requests/fuel-slip',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
