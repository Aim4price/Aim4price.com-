import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const dealerNav = read('app/dealer/dealer-nav.tsx');
const dealerStyles = read('app/dealer/dealer.module.css');
const leads = read('app/leads/leads-client.tsx');
const costReport = read('components/DealerCostOfOwnershipReportModal.tsx');
const maintenanceReport = read('components/DealerMaintenanceReportModal.tsx');

test('Dealer App Leads uses one continuous green-tinted page and navigation surface', () => {
  assert.match(dealerNav, /isLeadsPage \? styles\.navUnifiedSurface : isMaintenancePage \? styles\.navLeadsSurface/);
  assert.match(dealerStyles, /\.leadsModule\.leadsModule \{[\s\S]*?radial-gradient\(circle at 50% 4%, rgba\(111, 197, 150, 0\.13\)/);
  assert.match(dealerStyles, /\.navUnifiedSurface\.navUnifiedSurface \{[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/);
});

test('Dealer App report choices use short titles without descriptions', () => {
  assert.match(leads, /dealerAppMode \? 'Asset valuation' : 'Download asset valuation'/);
  assert.match(leads, /dealerAppMode \? 'Maintenance report' : 'Download maintenance report'/);
  assert.match(leads, /dealerAppMode \? 'Cost of ownership' : 'Download cost of ownership'/);
  assert.match(leads, /dealerAppMode \? null : <small>PDF value summary/);
  assert.equal((leads.match(/pdfOnly=\{dealerAppMode\}/g) ?? []).length, 2);
});

test('Dealer App report modals skip format selection but Dealer Account keeps it', () => {
  for (const source of [costReport, maintenanceReport]) {
    assert.match(source, /pdfOnly\?: boolean/);
    assert.match(source, /pdfOnly = false/);
    assert.match(source, /useState<ReportStep>\(pdfOnly \? 'timeline' : 'format'\)/);
    assert.match(source, /!pdfOnly && step === 'format'/);
    assert.match(source, /if \(pdfOnly\) \{\s*\(onBack \?\? onClose\)\(\);/);
    assert.match(source, /XLSX workbook/);
  }
});
