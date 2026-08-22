import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const assetRegister = read('../app/asset-register/asset-register-client.tsx');
const assetRegisterStyles = read('../app/asset-register/page.module.css');
const documents = read('../app/documents/documents-client.tsx');
const documentStyles = read('../app/documents/page.module.css');

const filterClients = [
  assetRegister,
  documents,
  read('../app/asset-discovery/asset-discovery-client.tsx'),
  read('../app/fuel/fuel-client.tsx'),
  read('../app/leads/leads-client.tsx'),
  read('../app/maintenance/maintenance-client.tsx'),
  read('../app/my-invoices/my-invoices-client.tsx'),
];

test('all filter launchers use the Documents slider icon', () => {
  for (const client of filterClients) {
    assert.match(client, /M4 5h16M7 12h10M10 19h4/);
    assert.match(client, /<circle cx="15" cy="5" r="1\.5" \/>/);
    assert.match(client, /<circle cx="9" cy="12" r="1\.5" \/>/);
    assert.match(client, /<circle cx="15" cy="19" r="1\.5" \/>/);
  }
});

test('filter launchers do not show a decorative dropdown icon', () => {
  const assetFilterButton = assetRegister.slice(
    assetRegister.indexOf('className={`${styles.secondaryButton} ${styles.filterTriggerButton}'),
    assetRegister.indexOf('</button>', assetRegister.indexOf('className={`${styles.secondaryButton} ${styles.filterTriggerButton}')),
  );
  const documentsFilterButton = documents.slice(
    documents.indexOf('className={`${styles.headerButton} ${styles.filtersButton}`}'),
    documents.indexOf('</button>', documents.indexOf('className={`${styles.headerButton} ${styles.filtersButton}`}')),
  );
  const leads = filterClients[4];
  const leadsFilterButton = leads.slice(
    leads.indexOf('className={`${assetStyles.secondaryButton} ${assetStyles.filterTriggerButton}'),
    leads.indexOf('</button>', leads.indexOf('className={`${assetStyles.secondaryButton} ${assetStyles.filterTriggerButton}')),
  );

  assert.match(assetFilterButton, /<FilterIcon/);
  assert.doesNotMatch(assetFilterButton, /ChevronDownIcon|filterChevron/);
  assert.match(documentsFilterButton, /<Icon name="filter" \/>/);
  assert.doesNotMatch(documentsFilterButton, /chevron-down|buttonChevron/);
  assert.match(leadsFilterButton, /<FilterIcon/);
  assert.doesNotMatch(leadsFilterButton, /ChevronDownIcon|filterChevron/);
  assert.doesNotMatch(documentStyles, /\.buttonChevron/);
});

test('Asset Register Filters matches the Summary and Download heading size', () => {
  assert.match(
    assetRegisterStyles,
    /\.registerHeader \.headerActions \.secondaryButton,\s*\.registerHeader \.headerActions \.filterTriggerButton\s*\{[\s\S]*?min-height:\s*clamp\(3\.45rem, 4\.2vw, 3\.9rem\)[\s\S]*?font-size:\s*clamp\(0\.98rem, 1\.15vw, 1\.08rem\)/,
  );

  const sizingRefinement = assetRegisterStyles.slice(
    assetRegisterStyles.indexOf('/* === Filter dropdown sizing refinement === */'),
    assetRegisterStyles.indexOf('.registerHeader .assetFilterMenu {', assetRegisterStyles.indexOf('/* === Filter dropdown sizing refinement === */')),
  );
  assert.doesNotMatch(sizingRefinement, /filterTriggerButton/);
});

test('summary arrows show concise Previous and Next hover words', () => {
  const registerSummary = assetRegister.slice(
    assetRegister.indexOf('<section className={styles.assetSummaryCarousel}'),
    assetRegister.indexOf('<div className={styles.toolbar}>', assetRegister.indexOf('<section className={styles.assetSummaryCarousel}')),
  );

  assert.match(registerSummary, /styles\.assetSummaryArrow} \$\{styles\.controlTooltip/);
  assert.match(registerSummary, /data-tooltip="Previous"/);
  assert.match(registerSummary, /data-tooltip="Next"/);
  assert.match(registerSummary, /aria-label="Show previous asset register summary cards"/);
  assert.match(registerSummary, /aria-label="Show next asset register summary cards"/);
  assert.match(assetRegisterStyles, /\.assetSummaryArrow span\s*\{\s*display:\s*block;/);
  assert.doesNotMatch(assetRegisterStyles, /\.assetSummaryCarousel > \.assetSummaryArrow:(?:first|last)-of-type::before/);
  assert.match(assetRegisterStyles, /\.controlTooltip::after\s*\{[\s\S]*?content:\s*attr\(data-tooltip\)/);

  assert.match(documents, /aria-label="Previous summary cards"\s*data-tooltip="Previous"/);
  assert.match(documents, /aria-label="Next summary cards"\s*data-tooltip="Next"/);
  assert.match(documentStyles, /\.summaryNav::after\s*\{[\s\S]*?content:\s*attr\(data-tooltip\)/);
  assert.match(documentStyles, /\.summaryNav:hover:not\(:disabled\)::after[\s\S]*?opacity:\s*1/);
});

test('quick export status choices use normal-weight labels', () => {
  const quickChoices = assetRegister.slice(
    assetRegister.indexOf('{quickPdfReportOptions.map((option) => ('),
    assetRegister.indexOf('</div>', assetRegister.indexOf('{quickPdfReportOptions.map((option) => (')),
  );

  assert.match(quickChoices, /styles\.pdfReportQuickLabel/);
  assert.doesNotMatch(quickChoices, /<strong>\{option\.label\}<\/strong>/);
  assert.match(assetRegister, /<strong>\{fullPdfReportOption\.label\}<\/strong>/);
  assert.match(assetRegister, /<strong>Choose Specific Assets<\/strong>/);
  assert.match(assetRegisterStyles, /\.pdfReportChoices \.pdfReportQuickLabel\s*\{[\s\S]*?font-weight:\s*500 !important;/);
});
