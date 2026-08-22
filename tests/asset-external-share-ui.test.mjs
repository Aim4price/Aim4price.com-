import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Share Asset opens the inside or outside Aim4price choice before either flow', async () => {
  const [client, component] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /type AssetShareDestination = 'choice' \| 'inside' \| 'outside'/);
  assert.match(client, /setAssetShareDestination\('choice'\);[\s\S]*?setQuoteAsset\(asset\)/);
  assert.equal((client.match(/<AssetShareDestinationPicker/g) ?? []).length, 2);
  assert.equal((client.match(/<AssetExternalShare/g) ?? []).length, 2);
  assert.match(client, /onInside=\{\(\) => setAssetShareDestination\('inside'\)\}/);
  assert.match(client, /onOutside=\{\(\) => setAssetShareDestination\('outside'\)\}/);
  assert.match(component, /<strong>Inside Aim4price<\/strong>/);
  assert.match(component, /<strong>Outside Aim4price<\/strong>/);
});

test('outside sharing maps saved details and exposes real multi-file sharing plus honest message-only fallbacks', async () => {
  const [client, component] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /function buildExternalShareAsset/);
  assert.match(client, /serialNumber: asset\.serialNumber/);
  assert.match(client, /yearModel: asset\.yearModel/);
  assert.match(client, /usage: buildAssetUsageValue\(asset\)/);
  assert.match(client, /condition: conditionLabel\(asset\.condition\)/);
  assert.match(client, /replacementPriceExVat: readAssetReplacementPriceExVat\(asset\)/);
  assert.match(client, /valueExVat: asset\.value/);
  assert.match(client, /normalizePhotos\(asset\.photos\)\.flatMap/);
  assert.match(client, /toAbsoluteUrl\(photoUrl\)/);
  assert.match(client, /publicUrl: buildAssetScanUrl\(asset\)/);
  assert.match(component, /navigator\.canShare\(\{ files: preparedFiles \}\)/);
  assert.match(component, /navigator\.share\(\{ title: copy\.subject, text: copy\.body, files: preparedFiles \}\)/);
  assert.match(component, /createExternalShareArchive\(preparedFiles\)/);
  assert.match(component, /type="file" accept=\{FILE_INPUT_ACCEPT\} multiple/);
  assert.match(component, /Saved documents start unselected to protect private files/);
  assert.match(component, /Message-only fallback/);
  assert.match(component, />WhatsApp<\/strong>/);
  assert.match(component, />Email<\/strong>/);
  assert.match(component, />Copy message<\/strong>/);
  assert.match(component, />Photos &amp; files<\/strong>/);
  assert.match(component, /Aim4price reports/);
  assert.match(component, /Saved documents/);
  assert.match(component, /Open report studio/);
  assert.match(component, /onOpenReportsAndDocuments/);
  assert.doesNotMatch(component, /onBack/);

  assert.match(client, /const quoteExternalShareReportFiles = useMemo<ExternalShareFileSource\[\]>/);
  assert.match(client, /const activeExternalShareReportFiles = useMemo<ExternalShareFileSource\[\]>/);
  assert.match(client, /buildAssetRegisterExportUrl\(\.\.\.baseExportArgs, 'pdf'\)/);
  assert.match(client, /buildAssetRegisterExportUrl\(\.\.\.baseExportArgs, 'xlsx'\)/);
  assert.match(client, /async function loadExternalShareDocumentFiles/);
  assert.equal((client.match(/reportFiles=\{/g) ?? []).length, 2);
  assert.equal((client.match(/loadDocumentFiles=\{/g) ?? []).length, 2);
});

test('the existing internal partner choices remain in the inside Aim4price path', async () => {
  const client = await readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');

  assert.match(client, /assetShareDestination === 'outside'[\s\S]*?assetShareInsideFlow/);
  assert.match(client, /Finance &amp; accounting/);
  assert.match(client, /<strong>Insurance<\/strong>/);
  assert.match(client, /<strong>Dealer<\/strong>/);
  assert.match(client, /<strong>Licence renewal<\/strong>/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('finance'\)/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('insurance'\)/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('replacement_quote'\)/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('license_renewal'\)/);
});

test('inside choices use a compact scrollbar-free 2x2 layout and outside sharing keeps polished send controls in reach', async () => {
  const [client, pageStyles, component, componentStyles, groupModal] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.module.css', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetGroupManagerModal.tsx', import.meta.url), 'utf8'),
  ]);

  assert.equal((client.match(/styles\.assetShareInsideModal/g) ?? []).length, 2);
  assert.match(client, /function handleShareModalTab\(event: KeyboardEvent\)/);
  assert.match(client, /const activeControlIndex = activeControl instanceof HTMLElement \? controls\.indexOf\(activeControl\) : -1/);
  assert.match(client, /activeControlIndex === -1[\s\S]*?event\.shiftKey \? lastControl : firstControl/);
  assert.match(client, /savedReturnFocus\.focus\(\{ preventScroll: true \}\)/);
  assert.match(client, /shareReturnFocusRef\.current = returnFocus/);
  assert.match(client, /if \(suppressShareFocusRestoreRef\.current\)[\s\S]*?suppressShareFocusRestoreRef\.current = false/);
  assert.match(client, /function restoreShareFocusAfterHandoff\(kind: 'asset-report' \| 'export' \| 'group-report'\)/);
  assert.match(client, /selectedQuoteOption && quoteDirectoryStage === 'location'/);
  assert.match(client, /id="asset-register-share-title" tabIndex=\{-1\}/);
  assert.match(client, /id="asset-quote-title" tabIndex=\{-1\}/);
  assert.match(pageStyles, /\.assetShareInsideModal \.assetQuoteChoiceGrid[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(pageStyles, /\.assetShareInsideModal \.assetQuoteChoiceGrid \.assetQuoteChoiceCard[\s\S]*?min-height: clamp\(9\.25rem, 17dvh, 10\.75rem\) !important/);
  assert.match(pageStyles, /@media \(max-width: 820px\)[\s\S]*?assetShareInsideModal[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important/);

  const insideScrollRule = pageStyles.match(/\.assetShareInsideModal \.assetQuoteScrollBody,\n\.assetShareInsideModal \.registerShareModalBody \{\n([\s\S]*?)\n\}/);
  assert.ok(insideScrollRule, 'inside sharing should size naturally without a permanent scrollbar gutter');
  assert.match(insideScrollRule[1], /flex: 0 1 auto !important/);
  assert.match(insideScrollRule[1], /overflow-y: visible !important/);
  assert.match(insideScrollRule[1], /scrollbar-gutter: auto !important/);
  assert.match(pageStyles, /@media \(max-width: 820px\)[\s\S]*?assetShareInsideModal[\s\S]*?overflow-y: auto !important/);

  const outsideScrollRule = pageStyles.match(/\.externalAssetShareModal \.assetQuoteScrollBody,\n\.externalAssetShareModal \.registerShareModalBody \{\n([\s\S]*?)\n\}/);
  assert.ok(outsideScrollRule, 'outside sharing should keep the dedicated scroll region');
  assert.match(outsideScrollRule[1], /flex: 1 1 auto !important/);
  assert.match(outsideScrollRule[1], /scrollbar-gutter: stable !important/);
  assert.doesNotMatch(pageStyles, /assetShareInsideModal[^\n]*::-webkit-scrollbar/);
  assert.match(pageStyles, /\.externalAssetShareModal \.assetQuoteScrollBody::\-webkit-scrollbar-thumb/);
  assert.match(componentStyles, /\.messagePreview::\-webkit-scrollbar-thumb/);
  assert.match(componentStyles, /\.externalActions \{[\s\S]*?position: sticky;[\s\S]*?bottom: -0\.35rem/);
  assert.match(componentStyles, /\.externalActionButtons \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(componentStyles, /@media \(max-width: 1080px\)[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(componentStyles, /@media \(max-width: 620px\)[\s\S]*?\.externalActions \{[\s\S]*?position: static;/);
  assert.match(componentStyles, /\.actionIcon \{[\s\S]*?width: 2\.65rem;[\s\S]*?height: 2\.65rem/);
  assert.match(componentStyles, /\.whatsappButton \.actionIcon svg \{[\s\S]*?width: 1\.58rem;[\s\S]*?height: 1\.58rem/);
  assert.match(component, /<path fill="currentColor" stroke="none" d="M8\.05 6\.95/);
  assert.match(component, /filePickerHeadingRef[\s\S]*?requestAnimationFrame[\s\S]*?focus\(\{ preventScroll: true \}\)/);
  assert.match(component, /<strong>Choose how to share<\/strong>/);
  assert.match(component, /className=\{styles\.externalActionButtons\}/);
  assert.match(component, /tabIndex=\{0\}[\s\S]*?aria-label="External asset details message preview"/);

  assert.equal((client.match(/<div className=\{styles\.assetShareInsideFlow\}>\s*<div className=\{styles\.optionsContent\}>/g) ?? []).length, 2);
  assert.match(client, /function openAssetShareReportsAndDocuments\(\)/);
  assert.match(client, /function openRegisterShareReportsAndDocuments\(\)/);
  assert.match(client, /onOpenReportsAndDocuments=\{openAssetShareReportsAndDocuments\}/);
  assert.match(client, /onOpenReportsAndDocuments=\{openRegisterShareReportsAndDocuments\}/);
  assert.match(client, /suppressShareFocusRestoreRef\.current = true/);
  assert.match(client, /document\.getElementById\('asset-report-title'\)\?\.focus/);
  assert.match(client, /id="asset-report-title" tabIndex=\{-1\}/);
  assert.match(client, /id="export-title" tabIndex=\{-1\}/);
  assert.match(client, /<strong>Saved documents<\/strong>/);
  assert.match(groupModal, /initialView\?: 'menu' \| 'reports'/);
  assert.match(groupModal, /setView\(group \? initialView : 'create'\)/);
  assert.match(groupModal, /id="asset-group-title" tabIndex=\{-1\}/);
  assert.match(groupModal, /<strong>Saved documents<\/strong>/);
});
