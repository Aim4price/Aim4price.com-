import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const globals = read('../app/globals.css');
const assetRegisterStyles = read('../app/asset-register/page.module.css');
const costClient = read('../app/my-invoices/my-invoices-client.tsx');
const maintenanceClient = read('../app/maintenance/maintenance-client.tsx');
const maintenanceStyles = read('../app/maintenance/page.module.css');
const fuelClient = read('../app/fuel/fuel-client.tsx');
const documentsClient = read('../app/documents/documents-client.tsx');
const umbrellaModal = read('../components/asset-register/AssetGroupManagerModal.tsx');
const dealerShareSelection = read('../components/DealerAssetShareSelection.tsx');
const assetRegistersClient = read('../app/asset-registers/asset-registers-client.tsx');
const adminClient = read('../app/admin/admin-client.tsx');
const appAccessClient = read('../app/account/app-access-management-client.tsx');
const header = read('../components/AppHeader.tsx');

test('shared asset-choice typography matches the Export Asset Register contract', () => {
  assert.match(
    globals,
    /\[data-asset-choice-header='true'\] h2,\s*\[data-asset-choice-header='true'\] h3\s*\{[\s\S]*?font-family:\s*var\(--font-heading, 'Montserrat'\), var\(--font-body, 'Inter'\), sans-serif !important;[\s\S]*?font-size:\s*clamp\(2rem, 3vw, 2\.75rem\) !important;[\s\S]*?font-weight:\s*900 !important;[\s\S]*?line-height:\s*1\.02 !important;[\s\S]*?letter-spacing:\s*-0\.065em !important;/,
  );
  assert.match(
    assetRegisterStyles,
    /\.assetFilterModalHeader h3,\s*\.exportModalHeader h3\s*\{[\s\S]*?font-size:\s*clamp\(2rem, 3vw, 2\.75rem\) !important;[\s\S]*?font-weight:\s*900 !important;[\s\S]*?line-height:\s*1\.02 !important;[\s\S]*?letter-spacing:\s*-0\.065em !important;/,
  );
  assert.match(globals, /\[data-asset-choice-copy='true'\] > strong\s*\{[\s\S]*?font-size:\s*clamp\(1rem, 1\.08vw, 1\.12rem\) !important;[\s\S]*?font-weight:\s*900 !important;[\s\S]*?line-height:\s*1\.2 !important;/);
  assert.match(globals, /\[data-asset-choice-meta='true'\]\s*\{[\s\S]*?font-size:\s*0\.93rem !important;[\s\S]*?font-weight:\s*660 !important;[\s\S]*?line-height:\s*1\.35 !important;/);
  assert.match(globals, /\[data-asset-choice-secondary='true'\]\s*\{[\s\S]*?font-size:\s*0\.86rem !important;[\s\S]*?font-weight:\s*660 !important;/);
  assert.match(globals, /\[data-asset-choice-value='true'\] > strong\s*\{[\s\S]*?font-size:\s*1rem !important;[\s\S]*?font-weight:\s*880 !important;/);
  assert.match(globals, /\[data-asset-choice-value='true'\] > small\s*\{[\s\S]*?font-size:\s*0\.8rem !important;[\s\S]*?font-weight:\s*780 !important;/);
});

test('asset-choice search, rows, selection and mobile behavior share one contract', () => {
  assert.match(globals, /\[data-asset-choice-toolbar='true'\] input\[type='search'\],\s*\[data-asset-choice-toolbar='true'\] input:not\(\[type\]\)\s*\{[\s\S]*?min-height:\s*3\.2rem !important;[\s\S]*?font-size:\s*1rem !important;[\s\S]*?font-weight:\s*760 !important;/);
  assert.match(globals, /\[data-asset-choice-toolbar='true'\] input::placeholder\s*\{[\s\S]*?font-weight:\s*820 !important;/);
  assert.match(globals, /\[data-asset-choice-row='true'\]\s*\{[\s\S]*?gap:\s*0\.9rem !important;[\s\S]*?padding:\s*0\.95rem 1rem !important;[\s\S]*?border-radius:\s*1\.1rem !important;/);
  assert.match(globals, /\[data-asset-choice-row='true'\]\[data-asset-choice-selected='true'\]\s*\{/);
  assert.match(globals, /@media \(max-width: 900px\)[\s\S]*?\[data-asset-choice-header='true'\] h2,[\s\S]*?font-size:\s*1\.62rem !important;/);
});

test('Cost Tracking System renames only the workspace title', () => {
  assert.match(costClient, /<h1>COST TRACKING SYSTEM<\/h1>/);
  assert.doesNotMatch(costClient, /<h1>COST LEDGER<\/h1>/);
  assert.match(header, /href:\s*'\/my-invoices',\s*label:\s*'Cost Ledger'/);
  assert.match(costClient, /aria-label="Cost Ledger actions"/);
});

test('primary operational asset pickers opt into the shared design', () => {
  for (const source of [costClient, maintenanceClient, fuelClient]) {
    assert.match(source, /data-asset-choice-surface/);
    assert.match(source, /data-asset-choice-modal/);
    assert.match(source, /data-asset-choice-header/);
    assert.match(source, /data-asset-choice-toolbar/);
    assert.match(source, /data-asset-choice-list/);
    assert.match(source, /data-asset-choice-row/);
    assert.match(source, /data-asset-choice-copy/);
    assert.match(source, /data-asset-choice-value/);
    assert.match(source, /data-asset-choice-footer/);
  }
});

test('Maintenance asset search uses the Cost Tracking single-input toolbar', () => {
  const toolbarMarker = '<div className={styles.pickerToolbar} data-asset-choice-toolbar="true">';
  const costToolbarStart = costClient.indexOf(toolbarMarker, costClient.indexOf('{assetPickerOpen ?'));
  const costToolbarEnd = costClient.indexOf('</div>', costToolbarStart);
  const firstToolbarStart = maintenanceClient.indexOf(toolbarMarker);
  const firstToolbarEnd = maintenanceClient.indexOf('</div>', firstToolbarStart);
  const secondToolbarStart = maintenanceClient.indexOf(toolbarMarker, firstToolbarEnd);
  const secondToolbarEnd = maintenanceClient.indexOf('</div>', secondToolbarStart);

  assert.notEqual(costToolbarStart, -1);
  assert.notEqual(firstToolbarStart, -1);
  assert.notEqual(secondToolbarStart, -1);

  for (const toolbar of [
    costClient.slice(costToolbarStart, costToolbarEnd),
    maintenanceClient.slice(firstToolbarStart, firstToolbarEnd),
    maintenanceClient.slice(secondToolbarStart, secondToolbarEnd),
  ]) {
    assert.match(toolbar, /<input[\s\S]*?placeholder="Search assets\.\.\."/);
    assert.match(toolbar, /className=\{styles\.secondaryButton\}/);
    assert.doesNotMatch(toolbar, /type="search"|disabled=|pickerSearchField|<SearchIcon|pickerClearButton/);
  }

  const primaryMaintenanceToolbar = maintenanceClient.slice(firstToolbarStart, firstToolbarEnd);
  const reportMaintenanceToolbar = maintenanceClient.slice(secondToolbarStart, secondToolbarEnd);
  assert.match(primaryMaintenanceToolbar, /value=\{pickerSearch\}[\s\S]*?setPickerSearch\(event\.target\.value\)[\s\S]*?setPickerSearch\(''\)/);
  assert.match(reportMaintenanceToolbar, /value=\{downloadAssetSearch\}[\s\S]*?setDownloadAssetSearch\(event\.target\.value\)[\s\S]*?setDownloadAssetSearch\(''\)/);
  assert.match(maintenanceStyles, /\.assetModal \.pickerToolbar\s*\{[\s\S]*?padding:\s*0 clamp\(1\.25rem, 2\.4vw, 2rem\) 1rem;/);
  assert.match(maintenanceStyles, /\.maintenanceExportBody \.pickerToolbar\s*\{\s*padding:\s*0 0 1rem;/);
});

test('nested document and umbrella asset selectors share row typography without replacing their parent modal', () => {
  for (const source of [documentsClient, umbrellaModal]) {
    assert.match(source, /data-asset-choice-surface="true"/);
    assert.match(source, /data-asset-choice-toolbar="true"/);
    assert.match(source, /data-asset-choice-list="true"/);
    assert.match(source, /data-asset-choice-row="true"/);
    assert.match(source, /data-asset-choice-selected=/);
    assert.match(source, /data-asset-choice-copy="true"/);
    assert.match(source, /data-asset-choice-meta="true"/);
  }
});

test('sharing, QR-label and app-access asset selectors use the shared design contract', () => {
  for (const source of [dealerShareSelection, assetRegistersClient, adminClient, appAccessClient]) {
    assert.match(source, /data-asset-choice-surface="true"/);
    assert.match(source, /data-asset-choice-list="true"/);
    assert.match(source, /data-asset-choice-row="true"/);
    assert.match(source, /data-asset-choice-selected=/);
    assert.match(source, /data-asset-choice-copy="true"/);
    assert.match(source, /data-asset-choice-meta="true"/);
  }

  for (const dedicatedModal of [assetRegistersClient, adminClient]) {
    assert.match(dedicatedModal, /data-asset-choice-modal="true"/);
    assert.match(dedicatedModal, /data-asset-choice-header="true"/);
    assert.match(dedicatedModal, /data-asset-choice-toolbar="true"/);
    assert.match(dedicatedModal, /data-asset-choice-footer="true"/);
  }
});
