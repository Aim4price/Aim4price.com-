import { NextRequest, NextResponse } from 'next/server';
import { getFieldManagerFuelStorageForOpen } from '../../../../../../lib/field-manager';
import {
  clearFieldManagerFuelScanCookie,
  requireActiveFieldManagerSession,
} from '../../../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    storageId: string;
  };
};

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireActiveFieldManagerSession(request);

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  try {
    const storage = await getFieldManagerFuelStorageForOpen({
      ownerUserId: access.session.ownerUserId,
      managerId: access.session.managerId,
      storageId: String(context.params?.storageId ?? ''),
    });

    if (!storage) {
      return NextResponse.json(
        { ok: false, error: 'This fuel storage unit is not available to this Field Manager login.' },
        { status: 403 },
      );
    }

    const redirectTo = `/field-manager/diesel/${encodeURIComponent(storage.publicFuelStorageCode)}`;
    const response = NextResponse.json({ ok: true, redirectTo });

    // Field Manager Fuel mode is authorized from the main Field Manager
    // session cookie. Do not mint a separate fuel scan-cookie authority.
    clearFieldManagerFuelScanCookie(response);

    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to open Field Manager fuel update.') },
      { status: 500 },
    );
  }
}
