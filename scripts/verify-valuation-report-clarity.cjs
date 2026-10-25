/**
 * Synthetic report evidence; no database, account cookies or client data.
 * Exercise real HTML builders, native Chromium print layout and XLSX output.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
const { PDFDocument } = require('pdf-lib');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const out = path.resolve(process.env.REPORT_EVIDENCE_DIR || 'report-evidence');
fs.mkdirSync(out, { recursive: true });

const pure = new Set([
  'fuel-report', 'report-theme', 'maintenance-report-style', 'report-print', 'simple-xlsx', 'usage-readings',
  'asset-groups-shared', 'admin-work-tracker-shared', 'report-chronology',
  'asset-depreciation-timeline', 'depreciation-umbrella-summary',
  'ownership-budget-tracker',
]);
const cache = new Map();
function load(file, extra = []) {
  const filename = path.resolve(file.endsWith('.ts') ? file : file + '.ts');
  const key = filename + extra.join(',');
  if (cache.has(key)) return cache.get(key);
  const source = fs.readFileSync(filename, 'utf8') +
    (extra.length ? '\nObject.assign(module.exports, { ' + extra.join(',') + ' });' : '');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename, reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics.length, 0, filename + ': syntax diagnostics');
  const module = { exports: {} };
  cache.set(key, module.exports);
  const req = (name) => {
    if (!name.startsWith('.')) return require(name);
    const target = path.resolve(path.dirname(filename), name);
    const stem = path.basename(target).replace(/\.ts$/, '');
    if (pure.has(stem)) return load(target);
    if (stem === 'report-logo') return { resolveReportLogoUrlForHtml: async () => logo };
    // Database/session imports are not executed by the pure report builders.
    return new Proxy({}, { get: (_target, property) => {
      throw Error('Unexpected live dependency in fixture: ' + name + '.' + String(property));
    } });
  };
  new Function('require', 'module', 'exports', compiled.outputText)(req, module, module.exports);
  return module.exports;
}
const logo = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" rx="8" fill="#eaf5ef"/><text x="15" y="49" font-size="25" fill="#103f35">DEMO</text></svg>').toString('base64');

(async()=>{
 const report=load('app/api/valuation/report/route.ts',['normalizePayload','renderValuationReportHtml']);
 const browser=await puppeteer.launch({pipe:true,args:['--no-sandbox','--disable-dev-shm-usage'],executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),headless:true});
 try {
  for(const calculated of [false,true]){
   const payload=report.normalizePayload({machineTitle:'Demo Compact Tractor',familyLabel:'Compact Tractor',brandName:'Demo',selectedValueExVat:250000,replacementPriceExVat:500000,yearSummary:'2014',usageSummary:'4 000 hours',conditionSummary:'Excellent · Detailed assessment',generatedAt:'2026-10-25T09:00:00Z',
    assetDetailRows:[{label:'Replacement price (excl. VAT)',value:'R 500 000 excl. VAT'}],
    recordRows:[{label:'Confidence',value:'Medium'},{label:'Generated',value:'25 Oct 2026'},{label:'Lifetime assumption',value:'12 000 hours'},{label:'Detailed Asset Assessment',value:'Applied'},{label:'Mechanical condition',value:'Excellent'},{label:'Body / frame / structure',value:'Excellent'},{label:'Tyres / wear components',value:'75–100%'},{label:'Service history',value:'Complete'}],
    saleabilityRows:[{label:'Realistic Market Value',value:calculated?'R 225 000 excl. VAT':'Calculate separately for your selling circumstances.'},{label:'Why prices differ',value:'Legacy long explanation'}]
   },logo);
   assert.equal(payload.assetDetailRows[0].label,'Replacement price');
   let html=report.renderValuationReportHtml(payload);
   const font=fs.readFileSync('public/field-manager/montserrat-latin.woff').toString('base64');
   html=html.replace('</head>','<style>@font-face{font-family:Montserrat;font-weight:100 900;src:url(data:font/woff;base64,'+font+')}</style></head>');
   const page=await browser.newPage();await page.setRequestInterception(true);page.on('request',req=>req.url().startsWith('http')?req.abort():req.continue());
   await page.setContent(html);await page.emulateMediaType('print');await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.evaluate(()=>document.body.textContent.includes('Market value not calculated')),!calculated);
   assert(!await page.evaluate(()=>document.body.textContent.includes('Legacy long explanation')));
   assert(await page.$$eval('.assetReportAssessmentSummary .assetReportRow > span',nodes=>nodes.every(el=>{const range=document.createRange();range.selectNodeContents(el);const boxes=[...range.getClientRects()];const value=el.nextElementSibling.getBoundingClientRect();return boxes.length===1&&boxes[0].right<=value.left;})),'Assessment labels must fit on one line without overlapping values');
   const name='valuation-'+(calculated?'calculated':'not-calculated');
   const pdf=await page.pdf({format:'A4',printBackground:true});fs.writeFileSync(path.join(out,name+'.pdf'),pdf);
   assert.equal((await PDFDocument.load(pdf)).getPageCount(),1);
   await page.close();
  }
  console.log('PASS replacement label, uncalculated/calculated market states, single-line assessment labels and single-page PDFs');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
