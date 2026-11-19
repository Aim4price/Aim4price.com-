import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { getAdminAssetOutcomesReport } from '../../../../lib/admin-asset-sales';
import { getAdminMarketplaceOutcomeReport } from '../../../../lib/admin-marketplace';
import { marketplaceRow, registerRow } from '../../../../lib/outcome-sales-report';
import { createOutcomePdf, createOutcomeWorkbook } from '../../../../lib/outcome-sales-files';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null);
  if (!body || !['marketplace','assets'].includes(body.source) || !['pdf','xlsx'].includes(body.format)
    || !Array.isArray(body.ids) || !body.ids.length || !body.ids.every((id: unknown) => typeof id === 'string')) {
    return NextResponse.json({error:'Select outcomes and a download format.'}, {status:400});
  }
  const assets = body.source === 'assets';
  const all = assets ? (await getAdminAssetOutcomesReport()).outcomes.map(registerRow)
    : (await getAdminMarketplaceOutcomeReport()).outcomes.map(marketplaceRow);
  const byId = new Map(all.map(row => [row.id, row]));
  const ids = new Set<string>(body.ids);
  const rows = Array.from(ids, id => byId.get(id)).filter(row => row !== undefined);
  if (rows.length !== ids.size) return NextResponse.json({error:'The outcomes changed. Refresh and try again.'}, {status:409});
  const source = assets ? 'Asset register' : 'Marketplace';
  const pdf = body.format === 'pdf';
  const bytes = pdf ? await createOutcomePdf(source, rows) : createOutcomeWorkbook(source, rows);
  return new Response(new Uint8Array(bytes), {headers:{
    'Cache-Control':'private, no-store',
    'Content-Disposition':`attachment; filename="Aim4price-${body.source}-outcomes.${body.format}"`,
    'Content-Type':pdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }});
}
