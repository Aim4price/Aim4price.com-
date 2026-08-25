import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { getAdminValuationReport } from '../../../../lib/admin-valuations';
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

