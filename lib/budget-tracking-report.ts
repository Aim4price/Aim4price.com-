import { budgetStatusLabel, type TrackedBudget } from './budget-tracking';
import { REPORT_THEME_CSS } from './report-theme';
import type { XlsxSheet } from './simple-xlsx';
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (value: number) => `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function buildBudgetReportHtml(budgets: TrackedBudget[], generated: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Budget Tracking Report</title><style>
  @page { size: A4; margin: 12mm; } * { box-sizing: border-box; } body { margin: 0; font: 13px/1.5 Arial,sans-serif; }
  main { background: white; padding: 24px; } header { border-bottom: 2px solid #197454; margin-bottom: 22px; padding-bottom: 18px; } h1 { font-size: 27px; margin: 6px 0; } h2 { font-size: 18px; margin: 0; } p { margin: 8px 0; color: #60756d; }
  article { break-inside: avoid; border: 1px solid #b9d0c5; border-radius: 10px; padding: 18px; margin: 16px 0; } dl { display: flex; gap: 28px; } dl div { flex: 1; } dt { color: #60756d; } dd { margin: 4px 0; font-weight: bold; font-size: 19px; }
  .track { height: 9px; background: #e6eeea; border-radius: 8px; overflow: hidden; } .fill { height: 100%; background: #197454; } .warning { background: #a76b12; } .over_budget { background: #b44242; }
  footer { font-size: 11px; color: #60756d; } ${REPORT_THEME_CSS}
  </style></head><body><main class="reportPage"><header><strong>Aim4price</strong><h1>Budget Tracking Report</h1><p>${budgets.length} ${budgets.length === 1 ? 'budget' : 'budgets'} · Generated ${escape(generated)} · Amounts incl. VAT</p></header>
  ${budgets.map(b => `<article><h2>${escape(b.assetTitle)}</h2><p>${b.period === 'monthly' ? 'Monthly' : 'Annual'} · ${escape(b.periodLabel)} · ${escape(budgetStatusLabel(b))}</p><dl><div><dt>Spent</dt><dd>${money(b.spent)}</dd></div><div><dt>Budget</dt><dd>${money(b.amount)}</dd></div><div><dt>${b.overBy > 0 ? 'Over budget' : 'Remaining'}</dt><dd>${money(b.overBy > 0 ? b.overBy : b.remaining)}</dd></div></dl><div class="track"><div class="fill ${escape(b.status)}" style="width:${Math.max(0,Math.min(100,b.percentUsed))}%"></div></div><p>${b.percentUsed}% used · Alert at ${b.warningPercent}% · Fuel ${b.includeFuelSlipCosts ? 'included' : 'excluded'}</p></article>`).join('')}
  <footer>Current budget periods. Actual spending comes from Cost Ledger records dated within each period. Budgets may overlap; their totals should not be added together.</footer></main></body></html>`;
}
export function buildBudgetWorkbook(budgets: TrackedBudget[], generated: string): XlsxSheet[] {
  return [{ name: 'Budgets', orientation: 'landscape', freezeRow: 4, columns: [42,16,24,20,20,20,20,18,18,18,26], rows: [
    [{ value: 'Budget Tracking Report', style: 'title' }],
    [{ value: `Generated ${generated} · Amounts incl. VAT · Current budget periods`, style: 'subtitle' }],
    [{ value: 'Budgets may overlap. Do not add their totals together.', style: 'note' }],
    ['Asset scope','Period','Current period','Budget','Spent','Remaining','Over budget','Used','Alert at','Fuel included','Status'].map(value => ({ value, style: 'tableHeader' })),
    ...budgets.map(b => [b.assetTitle,b.period,b.periodLabel,...[b.amount,b.spent,b.remaining,b.overBy].map(value => ({ value, style: 'currency' as const })),{ value: b.percentUsed / 100, style: 'percent' as const },{ value: b.warningPercent / 100, style: 'percent' as const },b.includeFuelSlipCosts,budgetStatusLabel(b)]),
  ] }];
}
