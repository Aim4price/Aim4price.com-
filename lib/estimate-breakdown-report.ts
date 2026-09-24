import type { EstimateBreakdown } from './estimate-breakdown';

const escape = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const money = (value: number) => `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The caller supplies only a server-verified snapshot, never posted report rows. */
export function appendEstimateBreakdownHtml(html: string, report: EstimateBreakdown, include: boolean): string {
  if (report.settings) html = html.replace('<h2>Estimated Value</h2>', '<h2>Manually adjusted estimate</h2>');
  if (!include) return html;
  const pages: { rows: EstimateBreakdown['rows']; notes: string[] }[] = [];
  for (let i = 0; i < report.rows.length; i += 8) pages.push({ rows: report.rows.slice(i, i + 8), notes: [] });
  if (!pages.length) pages.push({ rows: [], notes: [] });
  // Keep a generous footer allowance; lengthy calculation notes get a continuation page.
  pages[pages.length - 1].notes = report.notes.slice(0, 4);
  for (let i = 4; i < report.notes.length; i += 10) pages.push({ rows: [], notes: report.notes.slice(i, i + 10) });
  const count = pages.length + 1;
  html = html.replace(/Page 1 of 1/g, `Page 1 of ${count}`);
  const appendix = pages.map(({ rows, notes }, index) => `
    <main class="assetReportPage estimateBreakdownPage">
      <div class="assetReportInner">
        <header class="estimateBreakdownHeader"><strong>Aim4price</strong><span>Estimate breakdown${index ? ' - continued' : ''}</span></header>
        <h1>${escape(report.title.slice(0, 180))}</h1>
        <p>${report.settings ? 'Manually adjusted estimate. ' : ''}All amounts exclude VAT. Percentages apply to the preceding balance.</p>
        ${rows.length ? `<table><thead><tr><th>Adjustment</th><th>% change</th><th>Rand change</th><th>Balance</th></tr></thead><tbody>${rows.map((row) => `
          <tr><th>${escape(row.label)}</th><td>${row.percent === null ? '-' : `${row.percent > 0 ? '+' : ''}${Number(row.percent.toFixed(4))}%`}</td>
          <td>${row.change < 0 ? '-' : '+'}${escape(money(Math.abs(row.change)))}</td><td>${escape(money(row.value))}</td></tr>`).join('')}
        </tbody></table>` : ''}
        ${index === pages.length - 1 ? `<h2>Final estimate: ${escape(money(report.total))}</h2>` : ''}
        <ul>${notes.map((note) => `<li>${escape(note)}</li>`).join('')}</ul>
        <footer class="assetReportFooter"><div><p class="assetReportPowered">Powered by Aim4price.com</p>
          <div class="assetReportDisclaimer">Calculations retain precision until final rounding. Indicative estimate, not a certified appraisal.</div></div>
          <div class="assetReportPageNumber">Page ${index + 2} of ${count}</div></footer>
      </div>
    </main>`).join('');
  html = html.replace('</head>', `<style>
    .estimateBreakdownPage { break-before: page; }
    .estimateBreakdownHeader { display:flex; justify-content:space-between; border-bottom:1px solid #b9c2ce; padding:0 0 16px; font-size:14px; }
    .estimateBreakdownPage h1 { font-size:21px; line-height:1.3; margin:20px 0 10px; overflow-wrap:anywhere; }
    .estimateBreakdownPage p, .estimateBreakdownPage li { font-size:10px; line-height:1.6; }
    .estimateBreakdownPage table { width:100%; border-collapse:collapse; margin:18px 0; font-size:10px; }
    .estimateBreakdownPage td, .estimateBreakdownPage th { text-align:right; border-bottom:1px solid #d7dde5; padding:12px 6px; }
    .estimateBreakdownPage th:first-child { text-align:left; width:36%; }
    .estimateBreakdownPage thead { background:#f1f5f2; }
    .estimateBreakdownPage h2 { font-size:16px; margin:18px 0; }
    .estimateBreakdownPage ul { padding-left:18px; }
    .estimateBreakdownPage li { margin-bottom:8px; }
  </style></head>`);
  return html.replace(/\n\s*<script>\s*\n\s*\(function \(\) \{/, `${appendix}\n\n    <script>\n      (function () {`);
}
