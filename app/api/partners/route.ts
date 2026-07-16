import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { listPartnerDirectory, normalizePartnerType } from '../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession({ allowOwnerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const partnerType = normalizePartnerType(searchParams.get('type'));
  const search = searchParams.get('search');

  try {
    const partners = await listPartnerDirectory({
      currentUserId: session.user.id,
      partnerType,
      search,
    });

    return NextResponse.json({ ok: true, partners });
  } catch (error) {
    console.error('partners GET failed', error);
    return NextResponse.json(
      { ok: false, error: errorMessage(error, 'Failed to load partner directory.') },
      { status: 500 },
    );
  }
}
