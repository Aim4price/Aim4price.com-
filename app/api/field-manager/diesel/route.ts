import { NextRequest, NextResponse } from 'next/server';
import { listFieldManagerFuelStorages } from '../../../../lib/field-manager';
import { requireActiveFieldManagerSession } from '../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export async function GET(request: NextRequest) {
  const access = await requireActiveFieldManagerSession(request);

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  try {
    const storages = await listFieldManagerFuelStorages(access.session.ownerUserId);
    return NextResponse.json({ ok: true, storages });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to load Field Manager fuel storage units.') },
      { status: 500 },
    );
  }
}
