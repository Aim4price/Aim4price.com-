/**
 * Synthetic report evidence; no database, account cookies or client data.
 * Exercise real HTML builders, native Chromium print layout and XLSX output.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PDFDocument } = require('pdf-lib');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const out = path.resolve(process.env.REPORT_EVIDENCE_DIR || 'report-evidence');
fs.mkdirSync(out, { recursive: true });

const pure = new Set([
  'report-theme', 'report-print', 'simple-xlsx', 'usage-readings',
  'asset-groups-shared', 'admin-work-tracker-shared', 'report-chronology',
  'asset-depreciation-timeline', 'depreciation-umbrella-summary',
  'insurance-cover-catalogue',
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
const photos = [1,2,3,4,5].map(n => 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#d6e4dd"/><text x="100" y="170" font-size="45" fill="#103f35">Photo '+n+'</text></svg>').toString('base64'));
const generatedAt = '14 September 2026, 10:40';
const date = new Date('2026-09-14T08:40:00Z');
const ownerDetails = { businessName: 'Demonstration Farm', contactDetails: '012 345 6789', businessEmail: 'owner@example.com', locationAddress: 'George, South Africa' };
const asset = {
  id: 'asset-1', title: '2021 Demonstration Tractor with a long descriptive model name',
  kind: 'equipment', value: 219725, yearModel: 2021, brandName: 'Demo', modelName: 'Model 6000',
  selectedMethod: 'aim4price', condition: 'good', serialNumber: 'SERIAL-123456789',
  hours: 6720, usageMetric: 'hours', replacementPriceExVat: 650000,
  specsJson: {}, documents: [], photoUrls: photos, publicAssetCode: 'A4P-DEMO',
  plateLabel: 'A4P-DEMO', fuelPercent: 100, equipmentFamilyLabel: 'Tractors',
  createdAtIso: date.toISOString(), updatedAtIso: date.toISOString(),
};
const profile = { businessName: 'Demonstration Farm', email: 'owner@example.com', phone: '012 345 6789', addressLine1: 'George', logoUrl: logo };
const base = { title: 'Report', subtitle: 'Aim4price asset register', generatedAt, ownerEmail: ownerDetails.businessEmail, ownerDetails, logoUrl: logo, assetLabel: asset.title, selectedAsset: null, dateRangeLabel: 'All dates', xlsxUrl: '/api/maintenance/report?format=xlsx' };

async function fixtures() {
  const reports = {};
  const shared = load('lib/report-print.ts');
  reports.valuation = shared.buildAssetSheetReportHtml({
    logoUrl: logo, generatedAt, assetBadge: 'Tractors', heroTitle: asset.title, heroMeta: '2021 · 6 720 hours · Good',
    valueLabel: 'Current value', value: 'R 219 725', valueNote: 'Excl. VAT', statusLabel: 'Saved',
    facts: [{ label: 'Serial / VIN', value: asset.serialNumber }, { label: 'Replacement price', value: 'R 650 000' }],
    photoUrls: photos, notes: [{ label: 'Notes', value: 'A long asset note. '.repeat(30) }],
    methodCards: [{ label: 'Aim4price', value: 'R 219 725', note: 'Saved value', selected: true }],
  });
  reports['register-umbrella'] = shared.buildAssetRegisterSummaryReportHtml({
    logoUrl: logo, generatedAt, ownerName: 'Demonstration Farm', ownerMeta: 'George',
    intro: 'Selected umbrella assets', registerValue: 'R 4 394 500',
    stats: [{ label: 'Assets', value: '20' }], rows: Array.from({ length: 20 }, (_, i) => ({
      asset: asset.title + ' ' + (i+1), type: 'Tractor', method: 'Aim4price',
      detail: 'Umbrella: Farm equipment', value: 'R 219 725', replacementPrice: 'R 650 000',
      status: 'Saved', serial: asset.serialNumber, year: '2021', usage: '6 720 hours', condition: 'Good',
    })),
  });
  const maintenance = load('lib/asset-maintenance-report.ts');
  const maintenanceOptions = { ...base, reportScopeLabel: 'All maintenance',
    summary: { totalCount: 35, openCount: 0, doneCount: 35, dueSoonCount: 0, dueCount: 0, overdueCount: 0 },
    records: Array.from({ length: 35 }, (_, i) => ({
      id: 'record-'+i, status: 'done', computedStatus: 'done', title: 'Service record '+(i+1),
      assetTitle: asset.title, assetMeta: '2021 · Good', maintenanceType: 'service', triggerType: 'date',
      completedAtIso: date, completedUsage: 6720+i, completedBy: 'Demo mechanic',
      completedNotes: 'Oil, filters and coolant checked. '.repeat(i === 3 ? 25 : 2),
      updatedAtIso: date, usageMetric: 'hours',
    })),
  };
  reports.maintenance = maintenance.buildAssetMaintenanceReportHtml(maintenanceOptions);
  const workbook = load('lib/simple-xlsx.ts').createXlsxWorkbook(maintenance.buildAssetMaintenanceWorkbook(maintenanceOptions));
  assert.equal(Buffer.from(workbook).subarray(0,2).toString(), 'PK');
  fs.writeFileSync(path.join(out, 'maintenance.xlsx'), workbook);

  const invoices = load('lib/my-invoices-report.ts');
  reports.ownership = invoices.buildMyInvoicesReportHtml({ ...base,
    includeFuelSlipCosts: false,
    summary: { invoiceCount: 20, totalSpent: 23000, maintenanceSpend: 20000, partsSpend: 0, repairSpend: 0, vatTotal: 3000 },
    invoices: Array.from({ length: 20 }, (_, i) => ({
      id: 'invoice-'+i, assetId: asset.id, assetTitle: asset.title, source: 'manual',
      invoiceDate: '2026-09-14', invoiceNumber: 'INV-'+i, supplierName: 'Demonstration Supplier',
      totalIncVat: 1150, vatAmount: 150, notes: 'Scheduled service completed.',
      blocks: [{ blockType: 'maintenance', totalIncVat: 1150, description: 'Oil and filters', items: [] }],
      createdAtIso: date.toISOString(), updatedAtIso: date.toISOString(),
    })),
  });
  const fuel = load('app/api/fuel/report/route.ts', ['buildReportHtml']);
  const fuelTest = fs.readFileSync('tests/fuel-report.test.mjs', 'utf8');
  const fuelEvent = new Function(fuelTest.slice(fuelTest.indexOf('function fuelEvent('), fuelTest.indexOf("\ntest(", fuelTest.indexOf('function fuelEvent('))) + ';return fuelEvent;')();
  reports['fuel-ledger'] = fuel.buildReportHtml({ ...base, title: 'Fuel Ledger Report',
    storageName: 'Main tank', storageCode: 'FUEL-DEMO', storageFuelType: 'Diesel',
    totalIssued: 1500, totalWorkUseIssued: 1500, totalExcludedIssued: 0, totalStockIn: 3000,
    currentLitres: 1500, storageCount: 1, eventCount: 25,
    events: Array.from({ length: 25 }, (_, i) => fuelEvent({ id: 'fuel-'+i })),
  });

  const scan = load('app/api/asset-register/scan-report/route.ts', ['buildFuelReport', 'buildMaintenanceReport', 'buildDepreciationReport']);
  reports['asset-fuel-empty'] = scan.buildFuelReport(asset, [], ownerDetails, generatedAt, logo);
  reports['asset-maintenance-empty'] = scan.buildMaintenanceReport(asset, [], ownerDetails, generatedAt, logo);
  reports['depreciation-empty'] = scan.buildDepreciationReport(asset, [], ownerDetails, generatedAt, logo);

  const register = load('app/api/asset-register/export/route.ts', ['renderRegisterSummaryReportHtml', 'renderFullRegisterReportHtml']);
  const assets = Array.from({ length: 25 }, (_, i) => ({ ...asset, id: 'asset-'+i, publicAssetCode: 'A4P-DEMO-'+i }));
  reports.summary = await register.renderRegisterSummaryReportHtml(assets, profile, date, 'https://www.aim4price.com/api/asset-register/export');
  reports['full-register'] = await register.renderFullRegisterReportHtml([{ register: { id: 'register-1', ...profile }, items: assets }], profile, date, 'https://www.aim4price.com/api/asset-register/export');
  const valuation = load('app/api/valuation/report/route.ts', ['normalizePayload', 'renderValuationReportHtml']);
  reports.estimate = valuation.renderValuationReportHtml(valuation.normalizePayload({
    machineTitle: asset.title, sectorLabel: 'Agriculture', familyLabel: 'Tractors',
    selectedMethodLabel: 'Aim4price', selectedValueExVat: 219725, replacementPriceExVat: 650000,
    yearSummary: '2021', usageSummary: '6 720 hours', conditionSummary: 'Good', generatedAt: date.toISOString(),
  }, logo));

  const admin = load('lib/admin-work-tracker-report.ts');
  reports.retainer = admin.buildAdminWorkReportHtml({ client: { name: 'Demonstration Farm', accountType: 'owner' },
    generatedAt: date, history: { period: 'month', startIso: '2026-09-01T00:00:00Z', endIso: '2026-10-01T00:00:00Z', sessions: [] } });
  const insurance = load('lib/insurance-report.ts');
  const workspace = {
    clientName: 'Demonstration Farm', segments: ['commercial'], industryProfiles: ['agriculture'],
    snapshotRevisions: [], snapshotReference: 'DEMO-1', assetCount: 0, totalReplacementValue: 0,
    overview: { currentCoverCounts: { confirmed_included: 0, confirmed_excluded: 0, unknown: 0, not_recorded: 0, covered_elsewhere: 0, not_applicable: 0 } },
    policies: [], informationRequests: [], assessments: [], riskObjects: [], evidence: [], assets: [],
    locations: [], exposures: [], parties: [], notes: [], latestSnapshotDiffs: [],
  };
  for (const type of ['summary','detailed']) reports['insurance-'+type] = insurance.buildInsuranceReportHtml({
    workspace, broker: { displayName: 'Demo Broker', businessName: 'Demo Broker', logoUrl: logo }, type, reference: 'DEMO', generatedAtIso: date.toISOString(),
  });
  return reports;
}

(async () => {
  const reports = await fixtures();
  const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  const results = [];
  try {
    for (const [name, html] of Object.entries(reports)) {
      assert.match(html, /#edf4f0/);
      assert.match(html, /Save PDF \/ Print/);
      assert.match(html, /Powered by Aim4price.com/);
      fs.writeFileSync(path.join(out, name+'.html'), html);
      const page = await browser.newPage();
      await page.setJavaScriptEnabled(false); // Do not auto-open native print dialogs.
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url().startsWith('data:')) request.continue();
        else request.abort(); // Fixture rendering never contacts clients or external services.
      });
      await page.setViewport({ width: 1400, height: 1000 });
      await page.setContent(html, { waitUntil: 'load' });
      await page.screenshot({ path: path.join(out,name+'-desktop.png'), fullPage: true });
      for (const width of [390, 768, 1400]) {
        await page.setViewport({ width, height: 1000 });
        const size = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          width: document.documentElement.clientWidth,
        }));
        assert.ok(size.scroll <= size.width+2, name+' overflows screen at '+width+': '+JSON.stringify(size));
      }
      await page.screenshot({ path: path.join(out,name+'-screen.png'), fullPage: true });
      await page.emulateMediaType('print');
      const printState = await page.evaluate(() => {
        const sheet = document.querySelector('.assetReportPage,.fullRegisterPage,.reportPage,.paper,.page');
        return {
          toolbarVisible: [...document.querySelectorAll('.assetReportScreenBar,.screenBar,.actions')].some(node => getComputedStyle(node).display !== 'none'),
          overflow: sheet && getComputedStyle(sheet).overflow,
          height: sheet?.clientHeight, scroll: sheet?.scrollHeight,
        };
      });
      assert.equal(printState.toolbarVisible, false, name+' print toolbar');
      assert.ok(printState.scroll <= printState.height+2 || printState.overflow === 'visible', name+' clips print content');
      const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
      const parsed = await PDFDocument.load(pdf);
      const pages = parsed.getPageCount();
      assert.ok(pages >= 1, name+' empty PDF');
      if (['maintenance','ownership','full-register','register-umbrella'].includes(name)) assert.ok(pages > 1, name+' must exercise multiple pages');
      fs.writeFileSync(path.join(out,name+'.pdf'),pdf);
      results.push({ report: name, pages, screenWidths: [390,768,1400], printToolbarHidden: true });
      console.log('PASS '+name+': '+pages+' PDF pages, 3 screen widths');
      await page.close();
    }
  } finally {
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
