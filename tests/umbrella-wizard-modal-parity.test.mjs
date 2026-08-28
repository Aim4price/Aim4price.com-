import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const invoices = read("app/my-invoices/my-invoices-client.tsx");
const documents = read("app/documents/documents-client.tsx");
const wizardStyles = read("components/AimWizardModal.module.css");
const umbrellaStyles = read(
  "components/asset-register/AssetGroupManagerModal.module.css",
);

const slice = (source, start, end) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(
    startIndex >= 0 && endIndex > startIndex,
    `Expected ${start} before ${end}`,
  );
  return source.slice(startIndex, endIndex);
};

const budgetWizard = slice(
  invoices,
  "{budgetModalOpen ?",
  "{budgetDeleteCandidate ?",
);
const dropCodeWizard = slice(
  invoices,
  "{invoiceDropCodeOpen && !invoiceDropAssetPickerOpen ?",
  "{invoiceDropCodeOpen && invoiceDropAssetPickerOpen ?",
);
const recurringWizard = slice(invoices, "{recurringOpen ?", "{filterOpen ?");
const manualCostWizard = slice(
  invoices,
  "{formOpen ?",
  "{deleteCandidateInvoice ?",
);
const uploadWizard = slice(
  documents,
  "{modalMode && !showAssetPicker ?",
  "{showAssetPicker ?",
);

test("all five requested wizards use the shared umbrella modal shell", () => {
  assert.match(
    invoices,
    /import wizardStyles from '\.\.\/\.\.\/components\/AimWizardModal\.module\.css'/,
  );
  assert.match(
    documents,
    /import wizardStyles from '\.\.\/\.\.\/components\/AimWizardModal\.module\.css'/,
  );

  for (const wizard of [
    budgetWizard,
    dropCodeWizard,
    recurringWizard,
    manualCostWizard,
    uploadWizard,
  ]) {
    assert.match(wizard, /wizardStyles\.overlay/);
    assert.match(wizard, /wizardStyles\.dialog/);
    assert.match(wizard, /wizardStyles\.header/);
    assert.match(wizard, /wizardStyles\.closeButton/);
    assert.match(wizard, /wizardStyles\.body/);
    assert.match(wizard, /wizardStyles\.progress/);
    assert.match(wizard, /wizardStyles\.panel/);
    assert.match(wizard, /wizardStyles\.panelNumber/);
    assert.match(wizard, /wizardStyles\.footer/);
    assert.match(wizard, /wizardStyles\.secondaryAction/);
    assert.match(wizard, /wizardStyles\.primaryAction/);
  }
});

test("the shared shell carries the umbrella proportions, spacing and surfaces", () => {
  assert.match(
    umbrellaStyles,
    /\.dialog\s*\{[\s\S]*?width: min\(1120px, 100%\);[\s\S]*?border-radius: 30px;/,
  );
  assert.match(
    wizardStyles,
    /\.dialog\s*\{[\s\S]*?width: min\(1120px, 100%\) !important;[\s\S]*?border-radius: 30px !important;/,
  );

  assert.match(
    umbrellaStyles,
    /\.header\s*\{[\s\S]*?padding: 28px 36px 24px;[\s\S]*?border-bottom: 1px solid #d9e8e2;/,
  );
  assert.match(
    wizardStyles,
    /\.dialog \.header\s*\{[\s\S]*?padding: 28px 36px 24px !important;[\s\S]*?border-bottom: 1px solid #d9e8e2 !important;/,
  );

  assert.match(
    umbrellaStyles,
    /\.stepCard\s*\{[\s\S]*?padding: 24px 26px;[\s\S]*?border-radius: 22px;/,
  );
  assert.match(
    wizardStyles,
    /\.dialog \.panel\s*\{[\s\S]*?padding: 24px 26px !important;[\s\S]*?border-radius: 22px !important;/,
  );

  assert.match(
    umbrellaStyles,
    /\.footer\s*\{[\s\S]*?padding: 18px 36px max\(24px, env\(safe-area-inset-bottom\)\);/,
  );
  assert.match(
    wizardStyles,
    /\.dialog \.footer\s*\{[\s\S]*?padding: 18px 36px max\(24px, env\(safe-area-inset-bottom\)\) !important;/,
  );
});

test("wizard progress uses umbrella circles and connecting rules instead of segmented pills", () => {
  assert.match(
    wizardStyles,
    /\.progress\s*\{[\s\S]*?display: flex !important;[\s\S]*?gap: 0 !important;/,
  );
  assert.match(
    wizardStyles,
    /\.progressItem\s*\{[\s\S]*?padding: 0 !important;[\s\S]*?border-radius: 0 !important;[\s\S]*?background: transparent !important;/,
  );
  assert.match(
    wizardStyles,
    /\.progressItem:not\(:last-child\)::after\s*\{[\s\S]*?height: 2px;[\s\S]*?background: #dce8e3;/,
  );
  assert.match(
    wizardStyles,
    /\.progressItem > span\s*\{[\s\S]*?width: 44px !important;[\s\S]*?height: 44px !important;[\s\S]*?border-radius: 999px;/,
  );
  assert.match(
    wizardStyles,
    /\.progressItemCurrent > span\s*\{[\s\S]*?background: #168660 !important;/,
  );
});

test("the shared wizard remains usable as a mobile bottom sheet", () => {
  assert.match(
    wizardStyles,
    /@media \(max-width: 720px\)[\s\S]*?\.overlay\s*\{[\s\S]*?align-items: end;/,
  );
  assert.match(
    wizardStyles,
    /@media \(max-width: 720px\)[\s\S]*?\.dialog\s*\{[\s\S]*?border-radius: 24px 24px 0 0 !important;/,
  );
  assert.match(
    wizardStyles,
    /@media \(max-width: 720px\)[\s\S]*?\.progress\s*\{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/,
  );
  assert.match(
    wizardStyles,
    /@media \(max-width: 720px\)[\s\S]*?\.dialog \.secondaryAction,[\s\S]*?width: 100%;/,
  );
});
