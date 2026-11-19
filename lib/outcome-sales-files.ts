import { createXlsxWorkbook, type XlsxCellValue } from './simple-xlsx';
import { renderReportHtmlToPdf } from './report-pdf';
import { saleMoney, saleTotals, type SaleRow } from './outcome-sales-report';

const note = 'All final values exclude VAT. Sales totals count sold assets only. Assisted sales are sales marked Yes for Aim4price help.';
const headers = ['Asset', 'Owner', 'Date', 'Outcome', 'Helped?', 'Final value excl. VAT'];
function detail(row: SaleRow) {
  const hasFinancialOutcome = row.sold || row.outcome === 'Scrapped' || row.outcome === 'Traded';
  const finalValue = hasFinancialOutcome ? row.amount ?? 'Not recorded' : 'Not applicable';
  return [row.asset, row.owner, row.date, row.outcome, row.helped, finalValue];
}
function summary(rows: SaleRow[]): [string, number][] {
  const t = saleTotals(rows);
  return [['Sold assets',t.sold], ['Assisted sales',t.assisted], ['Sales missing a price',t.missing],
    ['Total sold excl. VAT',t.soldValue], ['Aim4price-assisted excl. VAT',t.assistedValue]];
}
export function createOutcomeWorkbook(source: string, rows: SaleRow[]) {
  const title = source + ' outcomes';
  const money = (value: number): XlsxCellValue => ({value,style:'currency'});
  return createXlsxWorkbook([
    {name:'Sales summary', columns:[36,28], rows:[
      [{value:title,style:'title'}], [note], ...summary(rows).map(([key,value],i)=>[key,i>=3 ? money(value) : value]),
    ], merges:[{fromRow:2,toRow:2,fromColumn:1,toColumn:2}], rowHeights:{2:54}},
    {name:'Outcomes', columns:[48,36,20,26,18,28,42], freezeRow:1, rows:[
      [...headers,'Outcome reference'].map(value=>({value,style:'tableHeader' as const})),
      ...rows.map(row=>[...detail(row).map(value => typeof value === 'number' ? money(value) : value),row.id]),
    ]},
  ]);
}
const escape = (s: string) => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function createOutcomePdf(source: string, rows: SaleRow[]) {
  const cells = (row: SaleRow) => detail(row).map(value=>'<td>'+escape(typeof value==='number' ? saleMoney(value) : value ?? '—')+'</td>').join('');
  return renderReportHtmlToPdf(`<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4 landscape;margin:13mm 12mm 17mm}body{font:11px Arial;color:#183d30}
    h1{font-size:24px;margin:8px 0}p{line-height:1.5}table{border-collapse:collapse;width:100%;margin-top:16px}
    th,td{text-align:left;padding:8px;border-bottom:1px solid #dbe4de;overflow-wrap:anywhere}
    th:last-child{text-align:right}th{background:#eaf2ed}td:last-child{text-align:right;white-space:nowrap}tr{break-inside:avoid}
    section{display:flex;justify-content:space-between;gap:12px;padding:12px;background:#edf5ef}b{display:block;font-size:16px;margin-top:5px}
    </style></head><body><strong>Aim4price</strong><h1>${escape(source)} outcomes</h1><p>${note}</p>
    <section>${summary(rows).map(([k,v],i)=>'<div>'+k+'<b>'+(i>=3?saleMoney(v):v)+'</b></div>').join('')}</section>
    <table><thead><tr>${headers.map(h=>'<th>'+h+'</th>').join('')}</tr></thead><tbody>${rows.map(r=>'<tr>'+cells(r)+'</tr>').join('')}</tbody></table></body></html>`);
}
