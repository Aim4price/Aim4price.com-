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
  const budgets = filterTrackedBudgets(data.budgets, params.get('q') || '', { asset: params.get('asset') || 'all', period: params.get('period') || 'all', status: params.get('status') || 'all' });
  const headers = { 'Cache-Control': 'private, no-store, max-age=0' };
  if (!budgets.length) return NextResponse.json({ error: 'No matching budgets to export.' }, { status: 404, headers });
  const generated = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
  try {
    if (params.get('format') === 'xlsx') {
      return new NextResponse(new Uint8Array(createXlsxWorkbook(buildBudgetWorkbook(budgets, generated))), { headers: { ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="Aim4price-budgets.xlsx"' } });
    }
    const pdf = await renderReportHtmlToPdf(buildBudgetReportHtml(budgets, generated), { baseUrl: request.nextUrl.origin });
    return new NextResponse(new Uint8Array(pdf), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="Aim4price-budgets.pdf"' } });
  } catch {
    return NextResponse.json({ error: 'Unable to prepare the budget report.' }, { status: 500, headers });
  }
}
