import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [client, valuationStyles, appStyles, ownerPage, dealerPage] = await Promise.all([
  read('app/valuation/valuation-client.tsx'),
  read('app/valuation/page.module.css'),
  read('app/dealer/dealer.module.css'),
  read('app/owner-app/valuation/page.tsx'),
  read('app/dealer/valuation/page.tsx'),
]);

test('Owner and Dealer continue to share one valuation client with app-only presentation', () => {
  assert.match(ownerPage, /<ValuationClient ownerAppMode \/>/);
  assert.match(dealerPage, /<ValuationClient dealerAppMode \/>/);
  assert.match(client, /styles\.appValuation/);
  assert.match(client, /Estimate \{step\} of \{WIZARD_STEPS\.length\}/);
});

test('app selections open as searchable lists and remain available when navigating backwards', () => {
  assert.match(client, /setEquipmentDropdownOpen\(compactAppMode\)/);
  assert.match(client, /setBrandDropdownOpen\(compactAppMode\)/);
  assert.match(client, /compactAppMode && step === 2[\s\S]*?setEquipmentDropdownOpen\(true\)/);
  assert.match(appStyles, /equipmentPickerCard[^\n]*equipmentDropdownTrigger[^\{]*\{[\s\S]*?display: none !important/);
  assert.match(appStyles, /equipmentPickerCard[^\n]*equipmentDropdownMenu[^\{]*\{[\s\S]*?background: transparent !important/);
});

test('condition assessment is a guided Simple or Detailed mobile flow', () => {
  assert.match(client, /conditionModeToggle/);
  assert.match(client, /Condition assessment type/);
  assert.match(client, /activeDetailedAssessmentSection/);
  assert.match(client, /detailedAssessmentSummary/);
  assert.match(client, /currentDetailedSection === 'Mechanical condition'/);
  assert.match(client, /currentDetailedSection === 'Required work'/);
  assert.match(valuationStyles, /\.appValuation \.conditionModeToggle/);
  assert.match(valuationStyles, /\.appValuation \.detailedAssessmentSummary/);
});

test('phone estimate uses compact sectors, safe sheets and persistent actions', () => {
  assert.match(appStyles, /Shared Owner\/Dealer Estimate: final phone-first overrides/);
  assert.match(appStyles, /sectorLargeGrid[^\{]*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(appStyles, /max-height: calc\(100dvh - 4px\) !important/);
  assert.match(appStyles, /font-size: 16px !important/);
  assert.match(appStyles, /wizardFooter[^\{]*\{[\s\S]*?position: sticky !important;[\s\S]*?env\(safe-area-inset-bottom\)/);
  assert.match(appStyles, /detailsModalActions[^\{]*\{[\s\S]*?position: sticky !important/);
});

test('result facts remain visible as a compact two-column mobile summary', () => {
  assert.match(appStyles, /resultFactsGrid[^\{]*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(client, /<span>Year model<\/span>/);
  assert.match(client, /<span>Usage<\/span>/);
  assert.match(client, /<span>Condition<\/span>/);
  assert.match(client, /<span>Popularity<\/span>/);
});
