import { NextResponse } from 'next/server';
import { resolveOwnerWorkspaceContext } from '../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Kept as an authenticated tombstone for older clients. Invoice reading is no
 * longer performed synchronously; new uploads go through the 24-hour,
 * human-verified capture queue.
 */
export async function POST(request: Request) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved.response;

  return NextResponse.json(
    {
      ok: false,
      error: 'Automatic invoice reading has been retired. Send the invoice for Aim4price capture instead.',
      captureEndpoint: '/api/capture-requests/invoice',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
