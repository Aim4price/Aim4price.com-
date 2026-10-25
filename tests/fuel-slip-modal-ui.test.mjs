import { assertNoWebsiteReflow } from './helpers/site-layout-audit.mjs';
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

const sharedResults = sliceBetween(client, 'const fuelSlipResults =', '  return (\n    <>\n      <main');
const manageDialog = sliceBetween(client, "&& managedFuelSlip ?", "&& fuelSlipManagerFilterOpen ?");
const managerModal = sharedResults + manageDialog + sliceBetween(
  client,
  "modalMode === 'fuel-slip-manager' && !isSlipsPage ?",
  "(modalMode === 'fuel-slip-manager' || isSlipsPage) && fuelSlipManagerFilterOpen",
);
const filterModal = sliceBetween(
  client,
  "(modalMode === 'fuel-slip-manager' || isSlipsPage) && fuelSlipManagerFilterOpen",
  "(modalMode === 'fuel-slip-manager' || isSlipsPage) && fuelSlipDownloadOpen",
);
const downloadModal = sliceBetween(
  client,
  "(modalMode === 'fuel-slip-manager' || isSlipsPage) && fuelSlipDownloadOpen",
  "(modalMode === 'fuel-slip-manager' || isSlipsPage) && historyFuelSlip",
);
// Anchor the JSX block: the allowance hook uses the same flow condition.
const uploadModal = sliceBetween(
  client,
  "{modalMode === 'fuel-slip' && fuelSlipFlow === 'upload'",
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
    for (const className of ['overlay', 'dialog', 'header', 'headerText', 'closeButton', 'body', 'panel', 'panelHeading', 'footer', 'secondaryAction', 'primaryAction']) {
      assert.match(modal, new RegExp('wizardStyles\\.' + className), 'Expected wizardStyles.' + className);
    }
    assert.match(modal, /role="dialog"/);
    assert.match(modal, /aria-modal="true"/);
  }

  assert.doesNotMatch(manualModal, /wizardStyles\.intro|renderFuelSlipWizardProgress/);
  assert.match(manualModal, /styles\.manualFuelSlipModal/);
  assert.match(manualModal, /FUEL_SLIP_PAGE_COPY\[fuelSlipFormPage\]/);
  assert.match(reviewModal, /FUEL_SLIP_PAGE_COPY\[fuelSlipFormPage\]/);
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
  assert.match(uploadModal, /Automatic upload/);
  assert.match(uploadModal, /Aim4price captures, verifies and allocates/);
  assert.match(uploadModal, /<section className=\{styles\.uploadPanel\}>[\s\S]*?Documents and photos/);
  assert.match(uploadModal, /<CaptureUploadDropzone[\s\S]*?onFiles=\{handleFuelSlipUploadFiles\}/);
  assert.match(uploadModal, /disabled=\{isSaving \|\| isExtractingFuelSlip\}/);
  assert.match(uploadModal, /inputLabel="Choose fuel slip or photo"/);
  assert.match(uploadModal, /styles\.modalFooter/);
  assert.doesNotMatch(uploadModal, /wizardStyles\.|fuelSlipUploadWizardModal|fuelSlipWizardPanel|fuelSlipWizardHeading/);
  assert.doesNotMatch(uploadModal, /renderFuelSlipExtraFields\(\)|renderFuelSlipValidationNotice\(\)|operational details/);
  assert.match(styles, /\.fuelSlipFlowBackdrop \.costUploadModal\s*\{[\s\S]*?width:\s*min\(100%, 860px\)/);
});

test('manual and review forms share the compact layout and save only after the final summary', () => {
  for (const modal of [manualModal, reviewModal]) {
    assert.match(modal, /styles\.manualFuelSlipModal/);
    assert.doesNotMatch(modal, /wizardStyles\.intro|renderFuelSlipWizardProgress/);
    assert.match(modal, /renderFuelSlipCurrentPage\(\)/);
    assert.match(modal, /onClick=\{handleFuelSlipFormBack\}/);
    assert.match(modal, /fuelSlipFormPage !== 'confirm'[\s\S]*?onClick=\{handleFuelSlipNextPage\}[\s\S]*?onClick=\{handleFuelSlipSaveClick\}/);
  }
  assert.match(manualModal, /Save fuel slip/);
  assert.match(reviewModal, /fuelSlipDraft\.id \? 'Save changes' : 'Save fuel slip'/);
  assert.match(client, /function handleFuelSlipStepSelect[\s\S]*?focusFuelSlipFirstEditableField\(\)/);
});

test('fuel slip manager is compact, scalable and exposes secondary details on demand', () => {
  assert.match(managerModal, /paginatedFuelSlipManagerSlips\.map/);
  assert.match(managerModal, /ref=\{fuelSlipManagerListRef\}/);
  assert.match(managerModal, /aria-expanded=\{isExpanded\}/);
  assert.match(managerModal, /aria-controls=\{detailsId\}/);
  assert.match(managerModal, /styles\.fuelSlipManagerExpanded/);
  assert.doesNotMatch(managerModal, /<span>Change history<\/span>/);
  assert.match(managerModal, /<ListPagination\s+label="Fuel slips pagination"/);
  assert.match(managerModal, /Show all fuel slips/);
  assert.match(managerModal, /styles\.fuelSlipManagerBackdrop/);
  assert.doesNotMatch(managerModal, /styles\.fuelSlipManagerEyebrow|>\s*Fuel Ledger\s*</);
  assert.doesNotMatch(managerModal, /styles\.fuelSlipManagerSummaryLabel|>\s*Ledger summary\s*</i);
  assert.match(managerModal, /activeFuelSlipManagerFilterChips\.map/);
  assert.match(managerModal, /removeFuelSlipManagerFilter\(chip\.id\)/);
  assert.match(managerModal, /Remove search for/);
  assert.match(managerModal, /<section className=\{styles\.fuelSlipManagerContextBar\} aria-label="Current fuel slip view">/);
  assert.match(managerModal, /role="group" aria-label="Active fuel slip search and filters"/);
  assert.match(managerModal, /Clear all/);
  assert.doesNotMatch(managerModal, /wizardStyles\.overlay/);
  assert.doesNotMatch(managerModal, /styles\.fuelSlipManagerDetailGrid/);
});

test('fuel slip filters use the Cost Ledger modal language without limiting month-only filtering', () => {
  assert.match(filterModal, /<FilterFlow title="Filter fuel slips"/);
  assert.match(filterModal, /dialogRef=\{fuelSlipManagerChildDialogRef\}/);
  assert.match(filterModal, /label="Which source or status\?"/);
  assert.match(filterModal, /year: value/);
  assert.match(filterModal, /month: value/);
  assert.doesNotMatch(filterModal, /disabled=\{draftFuelSlipManagerFilters\.year === 'all'\}/);
  assert.doesNotMatch(downloadModal, /styles\.fuelSlipManagerFilterModal/);
});

test('pagination limits rendering while exports send independent filters to the full-history endpoint', () => {
  assert.match(client, /visibleFuelSlipManagerSlips\.slice\(startIndex, startIndex \+ fuelSlipLimit\)/);
  const downloadHandler = sliceBetween(client, '<ReportDownloadFlow instantDownload compactTimeline title="Fuel slip reports"', 'historyFuelSlip ?');
  assert.match(downloadHandler, /scopedApiUrl\('\/api\/fuel\/slips\/export'\)/);
  assert.match(downloadHandler, /filters:\{assetId:selection\.assetId,year:selection\.year,month:selection\.month/);
  assert.doesNotMatch(downloadHandler, /paginatedFuelSlipManagerSlips|recentFuelSlips|fuelSlipManagerSearchTerm/);
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
  assert.match(extraction, /if \(isExtractingFuelSlip \|\| !captureAllowance\.ready\) return/);
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

test('manager and guided wizard stay usable on desktop and mobile viewports', () => {
  const redesignStyles = styles.slice(styles.indexOf('/* Fuel-slip wizard parity and high-volume manager */'));
  assert.match(redesignStyles, /\.fuelSlipManagerModal\.fuelSlipManagerModal \.fuelSlipManagerBody\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(0, 1fr\)/);
  assert.match(redesignStyles, /\.fuelSlipManagerModal\.fuelSlipManagerModal\s*\{[\s\S]*?width:\s*min\(1320px, var\(--website-dialog-reference-width, 100%\)\)[\s\S]*?height:\s*auto !important[\s\S]*?min-height:\s*0 !important/);
  assert.match(redesignStyles, /\.fuelSlipManagerPanel\s*\{[\s\S]*?max-height:\s*590px/);
  assert.match(redesignStyles, /\.fuelSlipManagerList\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(redesignStyles, /\.fuelSlipManagerModal \.fuelSlipManagerToolbarButtons\s*\{[\s\S]*?repeat\(auto-fit, minmax\(148px, 1fr\)\)/);
  assert.match(redesignStyles, /\.fuelSlipManagerModal button\.fuelSlipManagerToolbarButton\s*\{[\s\S]*?min-height:\s*64px !important[\s\S]*?border-radius:\s*16px !important/);
  assert.match(redesignStyles, /\.fuelSlipManagerContextChips > button\s*\{[\s\S]*?border-radius:\s*10px/);
  assert.match(redesignStyles, /\.fuelSlipManagerRowMain \.fuelSlipManagerStatusBadge\s*\{[\s\S]*?min-height:\s*42px[\s\S]*?border-radius:\s*10px/);
  assert.match(redesignStyles, /\.fuelSlipManagerModal \.fuelSlipManagerExpanded \.fuelSlipManagerRowActions button,[\s\S]*?min-height:\s*52px !important/);
  assert.match(redesignStyles, /\.fuelSlipManagerRowMain\s*\{[\s\S]*?grid-template-columns:\s*var\(--fuel-slip-manager-columns\)/);
  assertNoWebsiteReflow(redesignStyles);
  assert.doesNotMatch(redesignStyles, /"identity status"\s*"date details"\s*"fuel litres"\s*"amount amount"/);
  assert.doesNotMatch(redesignStyles, /\.fuelSlipManagerBackdrop\s*\{[\s\S]*?align-items:\s*flex-end;[\s\S]*?padding:\s*0;/);
  assert.match(redesignStyles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(redesignStyles, /\.fuelSlipManagerFilterModal\.fuelSlipManagerFilterModal\s*\{[\s\S]*?width:\s*min\(var\(--website-dialog-reference-width, 100%\), 960px\)[\s\S]*?border-radius:\s*2rem/);
  assert.match(redesignStyles, /\.fuelSlipManagerFilterModal \.fuelSlipFilterGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});


// Exercise the rate formatter under the same Node 20 runtime as CI.
import ts from 'typescript';
import vm from 'node:vm';
const numberExports = {};
vm.runInNewContext(ts.transpileModule(read('lib/fuel-slip-number.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: numberExports });

test('typed and pasted fuel rates insert a decimal after two digits', () => {
  const format = numberExports.formatFuelSlipPriceInput;
  let typed = '';
  for (const digit of '3660') typed = format(typed + digit);
  assert.equal(typed, '36.60');
  for (const [input, expected] of [
    ['3660', '36.60'], ['36,60', '36.60'], ['36.60', '36.60'],
    ['', ''], ['3', '3'], ['36', '36'], ['36.', '36.'],
    ['36.6', '36.6'], ['9,50', '9.50'], ['R 36,60', '36.60'],
    ['19.8345', '19.8345'], ['0.50', '0.50'],
  ]) assert.equal(format(input), expected, input);
  assert.equal(numberExports.parseFuelSlipDecimal(format('3660'), 4), 36.6);
});

test('purchase, payment and context are short pages without expanding accordions', () => {
  const fields = sliceBetween(client, 'function renderFuelSlipDetailsFields()', 'function renderFuelSlipPaymentFields()');
  assert.equal((fields.match(/className=\{styles\.fuelEntryLabel\}/g) ?? []).length, 6);
  const allFields = sliceBetween(client, 'function renderFuelSlipDetailsFields()', 'async function handleFuelEvidenceUpload');
  assert.doesNotMatch(allFields, /<details|type="file"/);
  for (const field of ['cardLast4', 'slipNumber', 'transactionNumber', 'documentTime', 'paymentMethod', 'cardType', 'operatorName', 'odometerReading', 'hourMeterReading', 'activityText', 'workAreaText', 'assetFuelPercentAfter', 'note']) {
    assert.ok(allFields.includes('fuelSlipDraft.' + field), field + ' must remain available');
  }
});

const stepExports = {};
const stepSource = sliceBetween(client, 'function getFuelSlipFormPages(', 'const FUEL_SLIP_PAGE_COPY') +
  sliceBetween(client, 'function getFuelSlipMissingFieldPage(', 'const FUEL_SLIP_CAPTURE_FILTER_OPTIONS');
vm.runInNewContext(ts.transpileModule(stepSource + '\nexports.pages = getFuelSlipFormPages; exports.pageForField = getFuelSlipMissingFieldPage;', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: stepExports });

test('asset and storage flows include all stages and return validation to the relevant page', () => {
  assert.equal(stepExports.pages(true).join(','), 'details,extra,activity,payment,context,attachment,confirm');
  assert.equal(stepExports.pages(false).join(','), 'details,extra,payment,context,attachment,confirm');
  for (const field of ['documentDate', 'fuelType', 'litres', 'totalAmount']) assert.equal(stepExports.pageForField(field), 'details');
  for (const field of ['odometerReading', 'hourMeterReading', 'operatorName']) assert.equal(stepExports.pageForField(field), 'extra');
  assert.equal(stepExports.pageForField('activityText'), 'activity');
  assert.equal(stepExports.pageForField('workAreaText'), 'context');
});

test('supporting attachment upload is owner scoped and separate from credit-based capture', () => {
  const upload = sliceBetween(client, 'async function handleFuelEvidenceUpload(', 'function renderFuelSlipAttachment()');
  assert.match(upload, /scopedApiUrl\('\/api\/fuel\/slips\/upload'\)/);
  assert.doesNotMatch(upload, /capture-requests|extract|allowance/i);
  assert.match(upload, /requestId !== fuelEvidenceRequestRef.current/);
  const route = read('app/api/fuel/slips/upload/route.ts');
  assert.match(route, /resolveOwnerWorkspaceContext\(request, \{ ledger: 'fuel' \}\)/);
  assert.match(route, /userId: resolved.context.ownerUserId/);
  assert.match(route, /contentType !== 'application\/pdf'/);
  for (const modal of [manualModal, reviewModal]) assert.match(modal, /disabled=\{isSaving \|\| isUploadingFuelEvidence\}/);
});

test('evidence upload preserves entry values and handles failure, invalid files and stale responses', async () => {
  const source = sliceBetween(client, 'async function handleFuelEvidenceUpload(', 'function renderFuelSlipAttachment()');
  let draft = { litres: '25', documentFileUrl: '/old', originalFilename: 'old.jpg' };
  let error = '', busy = false, calls = 0;
  const ref = { current: 0 };
  let response = { ok: true, json: async () => ({ uploads: [{ uploadId: 'new-id', url: '/new', fileName: 'slip.pdf', contentType: 'application/pdf', byteSize: 123 }] }) };
  const context = {
    isUploadingFuelEvidence: false, fuelEvidenceRequestRef: ref,
    setFuelEvidenceError: value => { error = value; }, setIsUploadingFuelEvidence: value => { busy = value; },
    setFuelSlipDraft: update => { draft = update(draft); },
    scopedApiUrl: value => value, appRealmForPath: () => 'website', window: { location: { pathname: '/fuel' } },
    FormData: class { append() {} },
    fetch: async () => { calls++; return response; },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  await context.handleFuelEvidenceUpload({ type: 'text/plain', size: 123 });
  assert.equal(calls, 0);
  assert.match(error, /JPG/);
  await context.handleFuelEvidenceUpload({ type: 'application/pdf', size: 123 });
  assert.equal(draft.litres, '25');
  assert.equal(draft.documentFileUrl, '/new');
  assert.equal(draft.originalFilename, 'slip.pdf');
  assert.equal(busy, false);
  response = { ok: false, json: async () => ({ error: 'Upload failed' }) };
  await context.handleFuelEvidenceUpload({ type: 'image/jpeg', size: 123 });
  assert.equal(error, 'Upload failed');
  assert.equal(draft.documentFileUrl, '/new');
  context.fetch = async () => { ref.current++; return { ok: true, json: async () => ({ uploads: [{ uploadId: 'stale', url: '/stale' }] }) }; };
  await context.handleFuelEvidenceUpload({ type: 'image/jpeg', size: 123 });
  assert.equal(draft.documentFileUrl, '/new');
});
