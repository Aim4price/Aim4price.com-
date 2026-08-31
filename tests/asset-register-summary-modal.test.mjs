import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(
  new URL('../app/asset-register/asset-register-client.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../app/asset-register/page.module.css', import.meta.url),
  'utf8',
);

const summarySections = client.slice(
  client.indexOf('const registerSummarySections'),
  client.indexOf('const quickPdfReportOptions'),
);
const summaryHandlers = client.slice(
  client.indexOf('function openSummaryModal()'),
  client.indexOf('function selectAssetFilter'),
);
const summaryModal = client.slice(
  client.indexOf('{isSummaryModalOpen ? ('),
  client.indexOf('{isAddAssetDestinationModalOpen ? ('),
);
const summaryExportBuilder = client.slice(
  client.indexOf('function buildAssetRegisterSummaryExportUrl'),
  client.indexOf('function mergeProfileWithRegister'),
);
const summaryStylesStart = styles.lastIndexOf('/* === Register summary: navigable section view === */');
const summaryStylesEnd = styles.indexOf(
  '/* === Manual Add Asset: visible click-to-select asset types === */',
  summaryStylesStart,
);
const summaryStyles = styles.slice(summaryStylesStart, summaryStylesEnd);

test('register summary uses five short navigable sections', () => {
  const sectionIds = [...summarySections.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  const tabLabels = [...summarySections.matchAll(/tabLabel: '([^']+)'/g)].map((match) => match[1]);

  assert.deepEqual(sectionIds, ['values', 'status', 'valuation', 'asset-types', 'supporting']);
  assert.deepEqual(tabLabels, ['Values', 'Status', 'Valuation', 'Asset types', 'Supporting']);
  assert.match(summaryHandlers, /function openSummaryModal\(\) \{\s*setActiveSummarySectionIndex\(0\);/);
  assert.match(summaryModal, /registerSummarySections\.map\(\(section, index\) =>/);
  assert.match(summaryModal, /activeRegisterSummarySection\.rows\.map\(\(row\) =>/);
  assert.doesNotMatch(summaryModal, /summarySimpleTable/);
});

test('register summary navigation and data table are accessible', () => {
  assert.match(summaryModal, /role="tablist" aria-label="Register summary sections"/);
  assert.match(summaryModal, /role="tab"[\s\S]*?aria-selected=\{isActive\}/);
  assert.match(summaryModal, /aria-controls="asset-register-summary-panel"/);
  assert.match(summaryModal, /tabIndex=\{isActive \? 0 : -1\}/);
  assert.match(summaryModal, /id="asset-register-summary-panel"/);
  assert.match(summaryModal, /role="tabpanel"/);
  assert.match(
    summaryModal,
    /aria-labelledby=\{`summary-tab-\$\{activeRegisterSummarySection\.id\}`\}/,
  );
  assert.match(summaryModal, /<table[\s\S]*?<th scope="col">Metric<\/th>/);
  assert.match(summaryModal, /<th scope="row">\{row\.label\}<\/th>/);
  assert.match(summaryModal, /data-label="Count"/);
  assert.match(summaryModal, /data-label="Excl\. VAT"/);
  assert.match(summaryModal, /data-label="Incl\. VAT"/);
});

test('register summary supports keyboard navigation and restores focus', () => {
  assert.match(client, /const summaryTriggerRef = useRef<HTMLButtonElement \| null>\(null\);/);
  assert.match(client, /const summaryDialogRef = useRef<HTMLDivElement \| null>\(null\);/);
  assert.match(client, /const summaryTabRefs = useRef<Array<HTMLButtonElement \| null>>\(\[\]\);/);
  assert.match(
    summarySections,
    /window\.requestAnimationFrame\(\(\) => \{\s*summaryTabRefs\.current\[0\]\?\.focus\(\);/,
  );
  assert.match(summaryHandlers, /summaryTriggerRef\.current\?\.focus\(\)/);
  assert.match(summaryHandlers, /event\.key === 'ArrowRight'/);
  assert.match(summaryHandlers, /event\.key === 'ArrowLeft'/);
  assert.match(summaryHandlers, /event\.key === 'Home'/);
  assert.match(summaryHandlers, /event\.key === 'End'/);
  assert.match(summaryHandlers, /selectSummarySection\(nextIndex, true\);/);
  assert.match(summaryHandlers, /function handleSummaryDialogKeyDown\(event: ReactKeyboardEvent<HTMLDivElement>\)/);
  assert.match(summaryHandlers, /if \(event\.key !== 'Tab'\)/);
  assert.match(summaryHandlers, /summaryDialogRef\.current\?\.querySelectorAll<HTMLElement>/);
  assert.match(summaryHandlers, /document\.activeElement === firstElement/);
  assert.match(summaryHandlers, /document\.activeElement === lastElement/);
  assert.match(summaryModal, /ref=\{summaryDialogRef\}/);
  assert.match(summaryModal, /onKeyDown=\{handleSummaryDialogKeyDown\}/);
  assert.match(summaryModal, /role="region"/);
  assert.match(summaryModal, /aria-label=\{`\$\{activeRegisterSummarySection\.title\} data`\}/);
  assert.match(summaryModal, /className=\{styles\.summaryTableScroll\}[\s\S]*?tabIndex=\{0\}/);
  assert.match(client, /ref=\{summaryTriggerRef\}/);
  assert.match(client, /aria-haspopup="dialog"/);
  assert.match(client, /aria-controls="asset-register-summary-dialog"/);
});

test('register summary opens the canonical browser PDF flow', () => {
  assert.match(summaryExportBuilder, /reportKind: 'summary'/);
  assert.match(summaryExportBuilder, /params\.set\('scope', registerIds\.length >= 2 \? 'combined' : 'all'\)/);
  assert.match(summaryExportBuilder, /params\.set\('registerId', cleanedRegisterId\)/);
  assert.match(summaryExportBuilder, /if \(accountantShareId\) params\.set\('accountantShareId', accountantShareId\)/);
  assert.match(summaryHandlers, /buildAssetRegisterSummaryExportUrl\(/);
  assert.match(summaryHandlers, /activeRegister\?\.id \|\| activeRegisterId,[\s\S]*?'html',[\s\S]*?accountantShareId/);
  assert.match(summaryHandlers, /const didOpen = openCanonicalReportUrl\(url\);/);
  assert.doesNotMatch(summaryHandlers, /window\.open\(url/);
  assert.match(summaryHandlers, /The register summary PDF window was blocked\./);
  assert.match(summaryHandlers, /Register summary PDF opened\./);
  assert.match(summaryModal, /onClick=\{handleDownloadRegisterSummary\}/);
});

test('register summary styling keeps one section readable on every viewport', () => {
  assert.ok(summaryStylesStart >= 0, 'final summary style block should exist');
  assert.match(summaryStyles, /\.summaryModal\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(summaryStyles, /\.summaryModalBody\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(summaryStyles, /\.summarySectionTabs\s*\{[\s\S]*?repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(
    summaryStyles,
    /\.summarySectionTab:focus-visible\s*\{[\s\S]*?outline:\s*3px solid #2c7256/,
  );
  assert.match(summaryStyles, /\.summarySectionTabActive::after\s*\{/);
  assert.match(summaryStyles, /\.summaryTableScroll\s*\{[\s\S]*?overflow:\s*auto/);
  assert.match(
    summaryStyles,
    /\.summaryTableScroll:focus-visible\s*\{[\s\S]*?outline:\s*3px solid #2c7256/,
  );
  assert.match(summaryStyles, /font-variant-numeric:\s*tabular-nums/);
  assert.match(
    summaryStyles,
    /@media \(max-width: 760px\)[\s\S]*?\.summarySectionTabs\s*\{[\s\S]*?overflow-x:\s*auto/,
  );
  assert.match(
    summaryStyles,
    /@media \(max-width: 760px\)[\s\S]*?\.summaryDataTable thead\s*\{[\s\S]*?clip-path:\s*inset\(50%\)/,
  );
  assert.doesNotMatch(summaryStyles, /\.summaryDataTable thead\s*\{\s*display:\s*none/);
  assert.match(summaryStyles, /\.summaryDataTable tbody td::before\s*\{[\s\S]*?attr\(data-label\)/);
});
