import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../lib/asset-register-account-access';
import { requireBusinessOrigin } from '../../../lib/business-network-api';
import { loadAnnualReview, calculateAnnualPreview } from '../../../lib/annual-review-preview';
import { annualPercentage, liveReviewYear, percentagePrice } from '../../../lib/annual-review-policy';
import { annualReceipt, applyAnnualReview, requireAnnualYear, type AnnualConfirmation } from '../../../lib/annual-review-live';
import { readAnnualReviewBody } from '../../../lib/annual-review-request';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function account() {
  // Full account access only. Shared links and restricted installed-app sessions cannot apply account-wide changes.
  const session = await getServerSession();
  return session && await getAssetRegisterAccountAccess(session) ? session.user : null;
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const safe = /^(Annual reviews|The review|Choose |Reload |Your assets|No eligible|Valuation rules|This request|This asset|Invalid )/.test(message);
  if (!safe) console.error('Annual review failed', error);
  return json({ error: safe ? message : 'Unable to complete the review. Please reload and try again.' }, 400);
}
export async function GET(request: NextRequest) {
  const user = await account();
  if (!user) return json({ error: 'Sign in with an active owner or dealer account.' }, 403);
  try {
    const year = liveReviewYear();
    if (!year) return json({ available: false, opensOn: '2027-01-01' });
    const receipt = await annualReceipt(user.id, year);
    if (receipt || request.nextUrl.searchParams.has('status')) return json({ available: !receipt, year, receipt });
    const data = await loadAnnualReview('', year, undefined, user.id);
    return json({ available: true, year, owner: { email: user.email, name: user.name }, assets: data.rows.map(entry => entry.row) });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    requireBusinessOrigin(request);
    const user = await account();
    if (!user) return json({ error: 'Sign in with an active owner or dealer account.' }, 403);
    const body = await readAnnualReviewBody(request);
    const year = requireAnnualYear(body.year);
    if (body.action === 'apply') return json(await applyAnnualReview(user.id, body as unknown as AnnualConfirmation));
    if (body.action !== 'preview' || typeof body.assetId !== 'string' || typeof body.revision !== 'string') throw new Error('Invalid review request.');
    if (await annualReceipt(user.id, year)) throw new Error('Reload your review. This year is already complete.');
    const percent = annualPercentage(body.percent);
    const data = await loadAnnualReview('', year, body.assetId, user.id);
    const row = data.rows[0]?.row;
    if (!row?.eligible) throw new Error('This asset is no longer eligible. Reload your review.');
    return json({ result: await calculateAnnualPreview('', year, row.id, percentagePrice(row.replacementPrice!, percent), body.revision, user.id) });
  } catch (error) { return failure(error); }
}
