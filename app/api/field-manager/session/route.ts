import { NextRequest, NextResponse } from 'next/server';
import { requireActiveFieldManagerSession } from '../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await requireActiveFieldManagerSession(request);

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  return NextResponse.json({
    ok: true,
    manager: {
      id: access.session.managerId,
      displayName: access.session.displayName,
      username: access.session.username,
    },
  });
}
