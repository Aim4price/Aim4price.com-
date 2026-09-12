import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const invoices = read("app/my-invoices/my-invoices-client.tsx");
const invoiceStyles = read("app/my-invoices/page.module.css");
const documents = read("app/documents/documents-client.tsx");
const assetRegister = read("app/asset-register/asset-register-client.tsx");
const umbrella = read(
  "components/asset-register/AssetGroupManagerModal.tsx",
);
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

test("all five wizards retain shared structure with their approved close controls", () => {
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
    assert.match(wizard, /accountStyles\.modalCloseButton/);
    assert.match(wizard, /accountStyles\.passwordModalCloseButton/);
    assert.match(wizard, /onClick=\{close[^}]*\}[^>]*aria-label="Close/);
    assert.match(wizard, /wizardStyles\.body/);
    if (wizard !== uploadWizard) {
      assert.doesNotMatch(wizard, /wizardStyles\.progress/);
      assert.doesNotMatch(wizard, /Your cost record is saved on the final step/);
    } else {
      assert.match(wizard, /wizardStyles\.progress/);
    }
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
    /\.dialog\s*\{[\s\S]*?width: min\(1120px, var\(--website-dialog-reference-width, 100%\)\);[\s\S]*?border-radius: 30px;/,
  );
  assert.match(
    wizardStyles,
    /\.dialog\s*\{[\s\S]*?width: min\(1120px, var\(--website-dialog-reference-width, 100%\)\) !important;[\s\S]*?border-radius: 30px !important;/,
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

test("legacy modal spacing is neutralised and laptop-height screens use a compact rhythm", () => {
  assert.match(
    wizardStyles,
    /\.dialog\s*\{[\s\S]*?margin: 0 !important;[\s\S]*?padding: 0 !important;/,
  );
  assert.match(
    wizardStyles,
    /\.dialog \.header\s*\{[\s\S]*?width: 100%;[\s\S]*?margin: 0 !important;/,
  );
  assert.match(
    wizardStyles,
    /\.dialog \.body\s*\{[\s\S]*?width: 100%;[\s\S]*?margin: 0 !important;/,
  );
  assert.match(
    wizardStyles,
    /@media \(min-width: 721px\) and \(max-height: 900px\)[\s\S]*?\.dialog \.header\s*\{[\s\S]*?padding-top: 22px !important;[\s\S]*?padding-bottom: 18px !important;/,
  );
  assert.match(
    wizardStyles,
    /@media \(min-width: 721px\) and \(max-height: 900px\)[\s\S]*?\.dialog \.body\s*\{[\s\S]*?padding-top: 20px !important;[\s\S]*?padding-bottom: 22px !important;/,
  );
  assert.match(
    wizardStyles,
    /@media \(min-width: 721px\) and \(max-height: 900px\)[\s\S]*?\.dialog \.panel\s*\{[\s\S]*?margin-top: 18px;[\s\S]*?padding: 20px 24px !important;/,
  );
});

test("every wizard restores the top spacing when its step changes", () => {
  for (const bodyRef of [
    "budgetWizardBodyRef",
    "recurringWizardBodyRef",
    "manualCostWizardBodyRef",
    "invoiceDropWizardBodyRef",
  ]) {
    assert.match(invoices, new RegExp(`${bodyRef}\\.current\\?\\.scrollTo`));
  }
  assert.match(documents, /uploadWizardBodyRef\.current\?\.scrollTo\(\{ top: 0, left: 0 \}\)/);
  assert.match(documents, /\[modalMode, showAssetPicker, uploadStep\]/);
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

test("Aim4price capture is the full-width final choice in Add asset cost", () => {
  const costChoices = slice(
    invoices,
    '<div className={styles.sourceChoiceGrid}>',
    '<div className={styles.modalFooter}>',
  );
  const manualIndex = costChoices.indexOf("Enter cost manually");
  const recurringIndex = costChoices.indexOf("Add recurring commitment");
  const captureIndex = costChoices.indexOf("Upload for Aim4price capture");

  assert.ok(
    manualIndex >= 0 && manualIndex < recurringIndex && recurringIndex < captureIndex,
    "manual and recurring choices should appear before Aim4price capture",
  );
  assert.match(
    costChoices,
    /styles\.aim4priceCaptureChoiceOption[\s\S]*?Upload for Aim4price capture/,
  );
  assert.match(
    invoiceStyles,
    /\.costChoiceModal \.aim4priceCaptureChoiceOption\s*\{[^}]*grid-column:\s*1 \/ -1/,
  );
});

test("Create umbrella reuses the export asset picker hierarchy with one modal scroll", () => {
  assert.match(assetRegister, /yearModel:\s*asset\.yearModel/);
  assert.match(assetRegister, /usageLabel:\s*buildAssetUsageValue\(asset\)/);
  assert.match(assetRegister, /conditionLabel:\s*asset\.condition \? conditionLabel\(asset\.condition\) : ''/);
  assert.match(assetRegister, /sourceLabel:\s*methodLabel\(asset\.selectedMethod\)/);

  assert.match(umbrella, /placeholder="Search\.\.\."/);
  assert.match(umbrella, />\s*Select all\s*</);
  assert.match(umbrella, />\s*Clear\s*</);
  assert.match(umbrella, /assetDetailLine\(asset\)/);
  assert.match(umbrella, /assetSourceLine\(asset, combinedMode\)/);
  assert.match(umbrella, /lockedAnchor \? 'Included' : selected \? 'Selected' : 'Select'/);
  assert.match(umbrella, /<AssetSerialNumber value=\{asset.serialNumber\} \/>/);
  assert.match(umbrella, /const memberValueOptions = group[\s\S]*?PRIMARY_MEMBER_VALUE_OPTIONS[\s\S]*?GROUPED_MEMBER_VALUE_OPTIONS/);
  assert.match(umbrella, /<AssetGroupMemberSelect[\s\S]*?options=\{memberValueOptionsFor\(asset\.id\)\}/);

  assert.match(umbrella, /editorBodyRef\.current\?\.scrollTo\(\{ top: 0, left: 0 \}\)/);
  const stepThree = slice(umbrella, '{editorStep === 3 ? (', '</section>');
  assert.doesNotMatch(stepThree, /autoFocus/);
  assert.doesNotMatch(umbrellaStyles, /\.assetPickerBody\s*\{/);
  assert.match(umbrellaStyles, /\.body\s*\{[^}]*overflow-y:\s*auto/);
  const assetListStyles = slice(umbrellaStyles, '.assetList {', '}');
  assert.doesNotMatch(assetListStyles, /max-height|overflow-y|flex:/);
  assert.match(
    umbrellaStyles,
    /\.assetList\s*\{[^}]*grid-auto-rows:\s*max-content/,
  );
  assert.match(
    umbrellaStyles,
    /\.assetRow,[\s\S]*?\.assetRowSelected\s*\{[^}]*display:\s*grid;[^}]*grid-auto-rows:\s*max-content;[^}]*min-height:\s*6\.1rem;[^}]*overflow:\s*visible/,
  );
  assert.match(
    umbrellaStyles,
    /\.assetRowMain\s*\{[^}]*min-height:\s*4\.15rem/,
  );
  assert.match(
    umbrellaStyles,
    /\.summary\s*\{[^}]*flex:\s*0 0 auto/,
  );
  assert.match(
    umbrellaStyles,
    /@media \(max-width: 900px\)[\s\S]*?\.assetRowMain\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\)[\s\S]*?\.assetValue\s*\{[^}]*grid-column:\s*2/,
  );
});

test("Manage umbrella explicitly removes deselected assets before save", () => {
  assert.match(
    umbrella,
    /const REMOVE_MEMBER_OPTION:[\s\S]*?value:\s*'remove'[\s\S]*?label:\s*'Remove from umbrella'[\s\S]*?tone:\s*'danger'/,
  );
  assert.match(
    umbrella,
    /const memberValueOptions = group[\s\S]*?REMOVE_MEMBER_OPTION[\s\S]*?: GROUPED_MEMBER_VALUE_OPTIONS/,
  );
  assert.match(
    umbrella,
    /if \(nextValue === REMOVE_MEMBER_OPTION\.value\)[\s\S]*?selectedAssetIds\.includes\(assetId\)\) toggleAsset\(asset\)/,
  );
  assert.match(
    umbrella,
    /function memberValueOptionsFor\(assetId: string\)[\s\S]*?option\.value === 'primary' \|\| option\.value === REMOVE_MEMBER_OPTION\.value/,
  );
  assert.match(
    umbrella,
    /disabled=\{!group && hasPrimaryAsset && selectedAssetIds\.length === 1\}/,
  );
  assert.match(
    umbrella,
    /aria-label=\{selected[\s\S]*?Remove \$\{asset\.title\} from umbrella[\s\S]*?Add \$\{asset\.title\} to umbrella/,
  );
  assert.match(
    umbrella,
    /memberIds:\s*selectedAssetIds/,
  );
  assert.match(
    umbrella,
    /Select assets to add, or clear a selected asset to remove it from this umbrella\./,
  );
  assert.match(
    umbrellaStyles,
    /\.memberSelectOptionDanger\s*\{[^}]*border-color:\s*#edcbc6;[^}]*background:\s*#fff7f5;[^}]*color:\s*#963b34/,
  );
});

