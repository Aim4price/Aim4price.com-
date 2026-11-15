import { MAINTENANCE_REPORT_FONT_CSS, MAINTENANCE_REPORT_LAYOUT_CSS } from './maintenance-report-style';
import { REPORT_THEME_CSS } from './report-theme';

export type PartsReportRow = {
  details?: Record<string,string>;
  part: string;
  description: string;
  brand: string;
  quantity: number;
  price: number | null;
  vat: string;
  dealer: string;
  town: string;
};

const escape = (value: string | number) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

export function buildPartsStockReportHtml(title: string, rows: PartsReportRow[], vatLabel: string, scope: string, generatedDate: string): string {
  const money = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(title)}</title><style>
    ${MAINTENANCE_REPORT_FONT_CSS}
    ${MAINTENANCE_REPORT_LAYOUT_CSS}
    ${REPORT_THEME_CSS}
    table { width:100%; border-collapse:collapse; table-layout:fixed; margin-top:16px; }
    thead { display:table-header-group; }
    tr { break-inside:avoid; }
    th,td { padding:8px; border:1px solid var(--line); vertical-align:top; text-align:left; overflow-wrap:anywhere; }
    th { background:var(--brand-soft); font-size:8px; font-weight:800; }
    td { font-size:9px; line-height:1.5; }
    tbody tr:nth-child(even) { background:var(--soft-2); }
    .number { text-align:right; } .quantity { text-align:center; }
    .dealer { display:block; margin-top:4px; color:var(--muted); font-size:8px; }
    .hero { break-inside:avoid; } .heroTitle { overflow-wrap:anywhere; }
  </style></head><body><main class="reportPage fullRegisterPage">
    <header class="topbar"><div class="brand"><div class="assetReportLogoFallback">AIM4PRICE</div><div><h1>Parts stock list</h1><p>Aim4price Parts Stock</p></div></div><div class="meta"><span>Generated</span><strong>${escape(generatedDate)}</strong></div></header>
    <section class="hero"><div class="heroMain"><p class="eyebrow">Parts report</p><h2 class="heroTitle">${escape(title)}</h2><p class="heroMeta">${escape(scope)}</p></div><div class="heroStatus"><span>Parts included</span><strong>${rows.length}</strong><p>Unit prices in ZAR · ${escape(vatLabel)}</p></div></section>
    <table><colgroup><col style="width:20%"><col style="width:32%"><col style="width:16%"><col style="width:10%"><col style="width:22%"></colgroup><thead><tr><th>Part number</th><th>Description / dealer</th><th>Brand</th><th class="quantity">Quantity</th><th class="number">Unit price · ${escape(vatLabel)}</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${escape(row.part)}</strong></td><td>${escape(row.description || '—')}${Object.entries(row.details || {}).map(([label,value])=>`<span class="dealer"><strong>${escape(label)}:</strong> ${escape(value)}</span>`).join('')}<span class="dealer">${escape([row.dealer, row.town].filter(Boolean).join(' · '))}</span></td><td>${escape(row.brand || '—')}</td><td class="quantity">${escape(row.quantity)}</td><td class="number">${row.price === null ? 'Price on request' : escape(money.format(row.price))}</td></tr>`).join('') || '<tr><td colspan="5">No matching parts.</td></tr>'}</tbody></table>
    <footer class="footer"><div><strong>Powered by Aim4price.com</strong><p>Confirm availability and price with the dealer.</p></div></footer>
  </main></body></html>`;
}

export async function buildPartsWorkbook(rows: PartsReportRow[]) {
  const { Workbook } = await import('exceljs');
  const book = new Workbook();
  book.creator = 'Aim4price.com';
  const sheet = book.addWorksheet('Parts');
  sheet.columns = [
    { header: 'Part number', key: 'part', width: 24 },
    { header: 'Description', key: 'description', width: 48 },
    { header: 'Brand', key: 'brand', width: 22 },
    { header: 'Quantity', key: 'quantity', width: 14 },
    { header: 'Unit price (ZAR)', key: 'price', width: 22 },
    { header: 'VAT basis', key: 'vat', width: 18 },
    { header: 'Dealer', key: 'dealer', width: 32 },
    { header: 'Town', key: 'town', width: 24 },
  ];
  const detailLabels = [...new Set(rows.flatMap(r=>Object.keys(r.details || {})))];
  detailLabels.forEach((label,i)=>{const col=sheet.getColumn(9+i);col.header=label;col.key=`detail-${i}`;col.width=32;col.numFmt="@";});
  rows.forEach(row => sheet.addRow({...row,...Object.fromEntries(detailLabels.map((label,i)=>[`detail-${i}`,row.details?.[label] || ""]))}));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {from:{row:1,column:1},to:{row:1,column:8+detailLabels.length}};
  sheet.getColumn('part').numFmt = '@';
  sheet.getColumn('price').numFmt = '"R" #,##0.00';
  sheet.eachRow((row, index) => {
    row.height = index === 1 ? 30 : 28;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { name: 'Calibri', size: 11, bold: index === 1, color: { argb: index === 1 ? 'FFFFFFFF' : 'FF173C32' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index === 1 ? 'FF103F35' : index % 2 ? 'FFF1F7F4' : 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });
  sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' };
  return book;
}
