import { NextRequest } from 'next/server';
import { GET as renderRegisterReport } from '../../../asset-register/export/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Keep existing links working, but generate the same scoped report as the owner flow. */
export async function GET(request: NextRequest, { params }: { params: { membershipId: string } }) {
  const url = new URL(request.url);
  url.pathname = '/api/asset-register/export';
  // Always use the path membership, never a caller-supplied replacement.
  url.searchParams.set('desktopMembership', params.membershipId);
  return renderRegisterReport(new NextRequest(url, { headers: request.headers }));
}
