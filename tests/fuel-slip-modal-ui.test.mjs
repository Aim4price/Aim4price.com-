import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const client = read('app/fuel/fuel-client.tsx');
const styles = read('app/fuel/page.module.css');

const sliceBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, 'Expected to find ' + startMarker);
  assert.ok(end > start, 'Expected ' + endMarker + ' after ' + startMarker);
  return source.slice(start, end);
};

const managerModal = sliceBetween(
  client,
  "modalMode === 'fuel-slip-manager' ?",
  "modalMode === 'fuel-slip-manager' && fuelSlipManagerFilterOpen",
);
const uploadModal = sliceBetween(
  client,
  "modalMode === 'fuel-slip' && fuelSlipFlow === 'upload'",
  "modalMode === 'fuel-slip' && fuelSlipFlow === 'manual-form'",
);
const manualModal = sliceBetween(
  client,
  "modalMode === 'fuel-slip' && fuelSlipFlow === 'manual-form'",
  "modalMode === 'fuel-slip' && fuelSlipFlow === 'review'",
);
const reviewModal = sliceBetween(
  client,
  "modalMode === 'fuel-slip' && fuelSlipFlow === 'review'",
  "modalMode === 'create-storage'",
);

test('fuel entry and review surfaces share the canonical cost wizard shell', () => {
  assert.ok(client.includes("import wizardStyles from '../../components/AimWizardModal.module.css'"));

  for (const modal of [manualModal, reviewModal]) {
    for (const className of ['overlay', 'dialog', 'header', 'headerText', 'closeButton', 'body', 'panel', 'panelHeading', 'panelNumber', 'footer', 'secondaryAction', 'primaryAction']) {
      assert.match(modal, new RegExp('wizardStyles\\.' + className), 'Expected wizardStyles.' + className);
    }
    assert.match(modal, /role="dialog"/);
    assert.match(modal, /aria-modal="true"/);
  }

  assert.match(manualModal, /Complete one short step at a time\. Your fuel slip is saved on the final step\./);
  assert.match(manualModal, /Add the slip details/);
  assert.match(manualModal, /Add usage and work details/);
  assert.match(reviewModal, /Extracted slip text/);
  assert.doesNotMatch(reviewModal, /Raw OCR and parser debug/);
});

test('Aim4price capture is an upload-only step with no operational-detail requirements', () => {
  const extraction = sliceBetween(client, 'async function handleFuelSlipExtract()', 'function preventFuelSlipImplicitSubmit');

  assert.match(extraction, /formData\.append\('file', fuelSlipUploadFile\)/);
  assert.match(extraction, /formData\.append\('targetType', targetType\)/);
  assert.match(extraction, /formData\.append\('targetId', targetId\)/);
  assert.doesNotMatch(extraction, /customerFields|missingCustomerFields|getFuelSlipMissingFields|submittedPayload/);
  assert.match(uploadModal, /role="dialog"/);
  assert.match(uploadModal, /aria-modal="true"/);
  assert.match(uploadModal, /styles\.formModal[\s\S]*?styles\.costUploadModal/);
  assert.match(uploadModal, /Upload fuel slip\/photo/);
  assert.match(uploadModal, /Aim4price assisted capture/);
  assert.match(uploadModal, /<section className=\{styles\.uploadPanel\}>[\s\S]*?Documents and photos/);
  assert.match(uploadModal, /styles\.uploadBox/);
  assert.match(uploadModal, /styles\.modalFooter/);
  assert.doesNotMatch(uploadModal, /wizardStyles\.|fuelSlipUploadWizardModal|fuelSlipWizardPanel|fuelSlipWizardHeading/);
  assert.doesNotMatch(uploadModal, /renderFuelSlipExtraFields\(\)|renderFuelSlipValidationNotice\(\)|operational details/);
  assert.match(styles, /\.fuelSlipFlowBackdrop \.costUploadModal\s*\{[\s\S]*?width:\s*min\(100%, 860px\)/);
});

test('fuel wizard keeps the canonical two-step progress and final-step save behavior', () => {
  const progress = sliceBetween(client, 'function renderFuelSlipWizardProgress()', 'function renderFuelSlipExtraFields()');

  assert.match(progress, /label: 'Slip', step: 1/);
  assert.match(progress, /label: 'Usage & work', step: 2/);
  assert.match(progress, /<li[\s\S]*?<span aria-hidden="true">[\s\S]*?<strong>\{label\}<\/strong>/);
  assert.match(progress, /aria-current=\{isCurrent \? 'step' : undefined\}/);
  assert.doesNotMatch(progress, /role="tab"/);
  assert.match(manualModal, /fuelSlipFormPage === 'details'[\s\S]*?>Next<\/button>[\s\S]*?Save fuel slip/);
  assert.match(client, /function handleFuelSlipStepSelect[\s\S]*?focusFuelSlipFirstEditableField\(\)/);
});

test('fuel slip manager is compact, scalable and exposes secondary details on demand', () => {
  const pageSize = client.match(/const FUEL_SLIP_MANAGER_PAGE_SIZE = (\d+);/);
  assert.ok(pageSize, 'Expected a manager page-size constant');
  assert.ok(Number(pageSize[1]) >= 20, 'Expected at least 20 compact slips per page');

  assert.match(managerModal, /paginatedFuelSlipManagerSlips\.map/);
  assert.match(managerModal, /fuelSlipManagerResultStart/);
  assert.match(managerModal, /fuelSlipManagerResultEnd/);
  assert.match(managerModal, /fuelSlipManagerFilteredTotals\.litres/);
  assert.match(managerModal, /fuelSlipManagerFilteredTotals\.amount/);
  assert.match(managerModal, /aria-live="polite"/);
  assert.match(managerModal, /ref=\{fuelSlipManagerListRef\}/);
  assert.match(managerModal, /aria-expanded=\{isExpanded\}/);
  assert.match(managerModal, /aria-controls=\{detailsId\}/);
  assert.match(managerModal, /styles\.fuelSlipManagerExpanded/);
  assert.match(managerModal, />\s*First\s*<\/button>/);
  assert.match(managerModal, />\s*Last\s*<\/button>/);
  assert.match(managerModal, /Show all fuel slips/);
  assert.match(managerModal, /styles\.fuelSlipManagerBackdrop/);
  assert.doesNotMatch(managerModal, /wizardStyles\.overlay/);
  assert.doesNotMatch(managerModal, /styles\.fuelSlipManagerDetailGrid/);
});

test('pagination only limits rendering while search, filters and downloads use the full loaded set', () => {
  assert.match(client, /visibleFuelSlipManagerSlips\.slice\(startIndex, startIndex \+ FUEL_SLIP_MANAGER_PAGE_SIZE\)/);
  assert.match(client, /recentFuelSlips\.filter\(\(slip\) => matchesFuelSlipManagerFilters\(slip, draftFuelSlipDownloadFilters, fuelSlipManagerSearchTerm\)\)/);

  const downloadHandler = sliceBetween(
    client,
    'function handleFuelSlipDownload()',
    'async function handleClearDipstickNote',
  );
  assert.doesNotMatch(downloadHandler, /paginatedFuelSlipManagerSlips/);
  assert.match(client, /setCurrentFuelSlipManagerPage\(1\);[\s\S]*?\}, \[fuelSlipManagerFilters, fuelSlipManagerSearch\]\)/);
  assert.match(client, /fuelSlipManagerListRef\.current\.scrollTop = 0/);
});

test('editing or backing out of a saved slip preserves the manager context', () => {
  const backHandler = sliceBetween(
    client,
    'function handleFuelSlipFormBack()',
    'function handleFuelSlipUploadBack()',
  );
  assert.match(backHandler, /if \(fuelSlipDraft\.id\)[\s\S]*?setModalMode\('fuel-slip-manager'\)/);
  assert.doesNotMatch(backHandler, /openFuelSlipManager\(\)/);

  const postSave = sliceBetween(
    client,
    'if (reviewingExistingSlip) {\n        setExpandedFuelSlipId',
    'setQuickLaunchAssetId(null);',
  );
  assert.match(postSave, /setExpandedFuelSlipId\(fuelSlipDraft\.id\)/);
  assert.match(postSave, /else \{[\s\S]*?setFuelSlipManagerSearch\(''\)/);
  assert.match(postSave, /else \{[\s\S]*?setFuelSlipManagerFilters\(DEFAULT_FUEL_SLIP_MANAGER_FILTERS\)/);
  assert.match(postSave, /else \{[\s\S]*?setCurrentFuelSlipManagerPage\(1\)/);
});

test('manager-origin cancellation and same-target backtracking preserve user context', () => {
  assert.match(client, /function openFuelSlipModal\(returnToManager = false\)/);
  assert.match(client, /openFuelSlipModal\(true\)/);
  assert.match(client, /function closeFuelSlipFlow\([\s\S]*?setModalMode\('fuel-slip-manager'\)/);
  assert.match(client, /setFuelSlipDraft\(\(current\) => current\.targetKey === value \? current :/);
  assert.match(client, /setFuelSlipReturnToManager\(true\);[\s\S]*?setFuelSlipDraft\(buildFuelSlipDraftFromRecord\(slip\)\)/);
});

test('upload capture cannot navigate away or let a stale response close a newer flow', () => {
  const extraction = sliceBetween(client, 'async function handleFuelSlipExtract()', 'function preventFuelSlipImplicitSubmit');
  assert.match(extraction, /if \(isExtractingFuelSlip\) return/);
  assert.match(extraction, /fuelSlipExtractionRequestRef\.current !== extractionRequest/);
  assert.match(extraction, /closeFuelSlipFlow\(\{ force: true \}\)/);
  assert.match(uploadModal, /aria-label="Close" disabled=\{isExtractingFuelSlip\}/);
  assert.match(uploadModal, /onClick=\{handleFuelSlipUploadBack\} disabled=\{isExtractingFuelSlip\}/);
});

test('manager child dialogs provide names, Escape handling, focus containment and stale-year recovery', () => {
  assert.match(client, /fuelSlipManagerChildDialogRef/);
  assert.match(client, /event\.key === 'Escape'/);
  assert.match(client, /event\.key !== 'Tab'/);
  assert.match(client, /trigger\?\.isConnected/);
  assert.match(client, /availableYears\.has\(filters\.year\) \? filters : \{ \.\.\.filters, year: 'all' \}/);
  assert.match(client, /aria-label=\{`\$\{isExpanded \? 'Hide' : 'View'\} details for/);
});

test('manager and two-step wizard stay usable on desktop and mobile viewports', () => {
  const redesignStyles = styles.slice(styles.indexOf('/* Fuel-slip wizard parity and high-volume manager */'));
  assert.match(redesignStyles, /\.fuelSlipManagerModal\.fuelSlipManagerModal \.fuelSlipManagerBody\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(0, 1fr\)/);
  assert.match(redesignStyles, /\.fuelSlipManagerList\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(redesignStyles, /\.fuelSlipManagerRowMain\s*\{[\s\S]*?grid-template-columns:\s*var\(--fuel-slip-manager-columns\)/);
  assert.match(redesignStyles, /@media \(max-width: 1040px\)[\s\S]*?grid-template-areas:/);
  assert.match(redesignStyles, /"identity status"\s*"date details"\s*"fuel litres"\s*"amount amount"/);
  assert.match(redesignStyles, /@media \(max-width: 720px\)[\s\S]*?\.fuelSlipWizardProgress\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(redesignStyles, /\.fuelSlipManagerBackdrop\s*\{[\s\S]*?align-items:\s*flex-end;[\s\S]*?padding:\s*0;/);
  assert.match(redesignStyles, /@media \(max-width: 480px\)[\s\S]*?\.fuelSlipManagerPanel\s*\{[\s\S]*?min-height:\s*10rem/);
  assert.match(redesignStyles, /@media \(prefers-reduced-motion: reduce\)/);
});
