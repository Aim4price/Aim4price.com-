import { NextRequest, NextResponse } from 'next/server';
import { GET as getAuthorizedBudgets } from '../route';
import { filterTrackedBudgets, type TrackedBudget } from '../../../../../lib/budget-tracking';
import { buildBudgetReportHtml, buildBudgetWorkbook } from '../../../../../lib/budget-tracking-report';
import { createXlsxWorkbook } from '../../../../../lib/simple-xlsx';
import { renderReportHtmlToPdf } from '../../../../../lib/report-pdf';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  // Use the budget endpoint's owner, finance and asset-scope checks for every export.
  const response = await getAuthorizedBudgets();
  if (!response.ok) return response;
  const data = await response.json() as { budgets: TrackedBudget[] };
  const params = request.nextUrl.searchParams;
  const format = params.get('format') || 'pdf';
  if (!['html','pdf','xlsx'].includes(format)) return NextResponse.json({ error: 'Unsupported report format.' }, { status: 400 });
  const budgets = filterTrackedBudgets(data.budgets, params.get('q') || '', { asset: params.get('asset') || 'all', period: params.get('period') || 'all', status: params.get('status') || 'all' });
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
  if (!budgets.length) return NextResponse.json({ error: 'No matching budgets to export.' }, { status: 404, headers });
  const assetName = params.get('asset') && params.get('asset') !== 'all' ? budgets[0]?.assetTitle : '';
  const filename = assetName ? `${assetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-budgets` : 'Aim4price-budgets';
  const generated = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
  try {
    if (params.get('format') === 'xlsx') {
      return new NextResponse(new Uint8Array(createXlsxWorkbook(buildBudgetWorkbook(budgets, generated))), { headers: { ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${filename}.xlsx"` } });
    }
    const html = buildBudgetReportHtml(budgets, generated);
    if (format === 'html') return new NextResponse(html, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
    const pdf = await renderReportHtmlToPdf(html, { baseUrl: request.nextUrl.origin });
    return new NextResponse(new Uint8Array(pdf), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}.pdf"` } });
  } catch {
    return NextResponse.json({ error: 'Unable to prepare the budget report.' }, { status: 500, headers });
  }
}
