import { NextRequest, NextResponse } from 'next/server';
import { getFieldManagerFuelStorageForOpen } from '../../../../../../lib/field-manager';
import {
  applyFieldManagerFuelScanCookie,
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
      storageId: String(context.params?.storageId ?? ''),
    });

    if (!storage) {
      return NextResponse.json(
        { ok: false, error: 'This diesel tank is not available to this Field Manager login.' },
        { status: 403 },
      );
    }

    const redirectTo = `/field-manager/diesel/${encodeURIComponent(storage.publicFuelStorageCode)}`;
    const response = NextResponse.json({ ok: true, redirectTo });

    applyFieldManagerFuelScanCookie(response, {
      managerId: access.session.managerId,
      ownerUserId: access.session.ownerUserId,
      displayName: access.session.displayName,
      publicFuelStorageCode: storage.publicFuelStorageCode,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to open Field Manager diesel update.') },
      { status: 500 },
    );
  }
}
