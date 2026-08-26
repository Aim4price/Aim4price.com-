import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { adminDeleteValuations, getAdminValuationReport } from '../../../../lib/admin-valuations';
import type {
  AdminValuationAccountFilter,
  AdminValuationModeFilter,
  AdminValuationRecordFilter,
  AdminValuationSort,
} from '../../../../lib/admin-valuations-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;

  const searchParams = request.nextUrl.searchParams;
  try {
    const report = await getAdminValuationReport({
      search: searchParams.get('search') ?? '',
      recordType: (searchParams.get('type') ?? 'all') as AdminValuationRecordFilter,
      valuationMode: (searchParams.get('mode') ?? 'all') as AdminValuationModeFilter,
      account: (searchParams.get('account') ?? 'all') as AdminValuationAccountFilter,
      sector: searchParams.get('sector') ?? '',
      period: searchParams.get('period') ?? 'all',
      sort: (searchParams.get('sort') ?? 'latest') as AdminValuationSort,
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 50),
    });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    console.error('admin valuations GET failed', error);
    return NextResponse.json(
      { ok: false, error: 'Admin valuations could not be loaded.' },
      { status: 500 },
    );
  }
}

function deleteErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'ADMIN_VALUATION_DELETE_IDS_REQUIRED') {
    return NextResponse.json(
      { ok: false, error: 'Select at least one valuation to delete.' },
      { status: 400 },
    );
  }
  if (code === 'ADMIN_VALUATION_DELETE_LIMIT_EXCEEDED') {
    return NextResponse.json(
      { ok: false, error: 'A maximum of 500 valuations can be deleted at once.' },
      { status: 400 },
    );
  }
  if (code === 'ADMIN_VALUATION_DELETE_ID_INVALID') {
    return NextResponse.json(
      { ok: false, error: 'One or more valuation references are invalid.' },
      { status: 400 },
    );
  }

  console.error('admin valuations DELETE failed', error);
  return NextResponse.json(
    { ok: false, error: 'The selected valuation data could not be permanently deleted.' },
    { status: 500 },
  );
}

export async function DELETE(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, error: 'Select at least one valuation to delete.' },
        { status: 400 },
      );
    }

    const deletion = await adminDeleteValuations({
      valuationIds: body.valuationIds,
      adminUserId: access.actor.userId,
      adminName: access.actor.displayName,
    });
    return NextResponse.json({ ok: true, deletion });
  } catch (error) {
    return deleteErrorResponse(error);
  }
}
