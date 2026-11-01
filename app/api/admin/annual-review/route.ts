import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess, adminApiError } from '../../../../lib/admin-api-access';
import { loadAnnualReview, calculateAnnualPreview } from '../../../../lib/annual-review-preview';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown) => NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  try {
    const email = request.nextUrl.searchParams.get('email')?.trim() || '';
    if (!email || email.length > 254) return adminApiError('Enter an owner email.');
    const data = await loadAnnualReview(email, request.nextUrl.searchParams.get('year'));
    return json({ previewOnly: true, owner: { email: data.owner.email, name: data.owner.name }, year: data.year, assets: data.rows.map(entry => entry.row) });
  } catch (error) { return adminApiError(error instanceof Error ? error.message : 'Unable to load preview.'); }
}
/** POST calculates only. There is deliberately no apply/save endpoint. */
export async function POST(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  try {
    const body = await request.json();
    if (body.action !== 'preview' || typeof body.email !== 'string' || body.email.length > 254 || typeof body.assetId !== 'string' || typeof body.revision !== 'string') return adminApiError('Invalid preview request.');
    if (body.replacementPrice !== undefined && typeof body.replacementPrice !== 'number') return adminApiError('Invalid replacement price.');
    return json({ previewOnly: true, result: await calculateAnnualPreview(body.email, body.year, body.assetId, body.replacementPrice, body.revision) });
  } catch (error) { return adminApiError(error instanceof Error ? error.message : 'Unable to calculate preview.'); }
}
