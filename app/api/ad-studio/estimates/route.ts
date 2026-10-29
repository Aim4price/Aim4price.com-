import { listAssetRegisterItems } from '../../../../lib/asset-register-db';
import { withRealisticSellingAssessments } from '../../../../lib/realistic-selling-assessments';
import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getDealerAppSession } from '../../../../lib/dealer-app-session';
import { dealerRoleCan } from '../../../../lib/dealer-app-access';
import { getDb } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  const [profile, dealer] = await Promise.all([
    getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email }),
    getDealerAppSession(),
  ]);
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active' || (dealer && !dealerRoleCan(dealer.role, 'ad_studio'))) {
    return NextResponse.json({ ok: false, error: 'Advert Studio is not available for this account.' }, { status: 403 });
  }
  try {
    // Only the signed-in seller's calculated estimates; never accept a typed reference value.
    const { rows } = await getDb().query(`
      select id, brand_name, model_name, year_model, hours, condition,
        aim4price_value_ex_vat, created_at, valuation_payload
      from valuation_runs
      where user_id = $1 and aim4price_value_ex_vat > 0
      order by created_at desc limit 100
    `, [session.user.id]);
    const assets = await withRealisticSellingAssessments(await listAssetRegisterItems(session.user.id));
    const byRun = new Map(assets.filter(asset=>asset.valuationRunId).map(asset=>[String(asset.valuationRunId),asset]));
    const estimates = rows.map((row) => {
      const payload = row.valuation_payload ?? {};
      const input = payload.input ?? {};
      const unit = payload.selectedUsageMode ?? input.usageMode ?? input.usage_mode ?? 'hours';
      const usageUnit = unit === 'km' || unit === 'percent' ? unit : 'hours';
      const usage = usageUnit === 'percent'
        ? (payload.selectedLifeWorkedPercent ?? input.lifeWorkedPercent ?? input.life_worked_percent)
        : (input.usageAmount ?? input.usage_amount ?? input.hours ?? row.hours);
      const asset = byRun.get(String(row.id));
      const assessment = asset?.realisticSellingAssessment;
      // Reusing a historical run must not attach a newer asset's market estimate.
      const matches = asset && asset.yearModel === row.year_model && Number(asset.hours) === Number(row.hours) && asset.condition === row.condition && asset.value === Number(row.aim4price_value_ex_vat);
      return {
        realisticSellingPriceExVat: matches ? assessment?.priceExVat : undefined,
        sellingPriceNeedsReview: !!assessment && (!matches || assessment.needsReview),
        id: String(row.id), title: [row.brand_name, row.model_name].filter(Boolean).join(' '),
        year: row.year_model == null ? '' : String(row.year_model),
        usage: usage == null ? '' : String(usage), usageUnit,
        condition: String(row.condition || 'good'), valueExVat: Number(row.aim4price_value_ex_vat),
        createdAt: new Date(row.created_at).toISOString(),
      };
    });
    return NextResponse.json({ ok: true, estimates }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Advert Studio estimates failed', error);
    return NextResponse.json({ ok: false, error: 'Could not load saved estimates. You can still create an advert without a rating.' }, { status: 500 });
  }
}
