import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8');
const uploadModal = readFileSync(new URL('../components/documents/AssetDocumentUploadModal.tsx', import.meta.url), 'utf8');
const uploadModalStyles = readFileSync(new URL('../components/documents/AssetDocumentUploadModal.module.css', import.meta.url), 'utf8');
const documentTypes = readFileSync(new URL('../lib/account-document-taxonomy.ts', import.meta.url), 'utf8');
const header = readFileSync(new URL('../components/AppHeader.tsx', import.meta.url), 'utf8');
const headerStyles = readFileSync(new URL('../components/AppHeader.module.css', import.meta.url), 'utf8');

test('quick add uses the searchable typed Documents Vault flow', () => {
  const panel = client.slice(
    client.indexOf('<div className={styles.assetDocumentsPanel}>'),
    client.indexOf('<div className={styles.assetDetailDivider}', client.indexOf('<div className={styles.assetDocumentsPanel}>')),
  );

  assert.match(panel, /openAssetDocumentUpload\(asset\)/);
  assert.doesNotMatch(panel, /Asset documents/i);
  assert.match(panel, /href=\{`\/documents\?assetId=/);
  assert.match(panel, /vaultDocuments\.slice\(0, 3\)/);
  assert.match(panel, /detailDocuments\.slice/);
  assert.match(panel, /`\$\{vaultDocuments\.length\} Documents`/);
  assert.match(panel, /earlier saved asset/);
  assert.doesNotMatch(panel, /totalAssetDocuments/);
  assert.doesNotMatch(panel, /<ModalSelect/);
  assert.doesNotMatch(panel, /type="file"/);

  assert.match(client, /<AssetDocumentUploadModal/);
  assert.match(uploadModal, /ACCOUNT_DOCUMENT_TYPES/);
  assert.match(uploadModal, /type="search"/);
  assert.match(uploadModal, /role="combobox"/);
  assert.match(uploadModal, /event\.composedPath\(\)\.includes\(typeComboboxRef\.current\)/);
  assert.doesNotMatch(uploadModal, /onBlur=\{\(\) => window\.setTimeout/);
  assert.match(uploadModal, /Choose the document type before uploading/);
  assert.match(uploadModal, /form\.set\('documentType', selectedType\.value\)/);
  assert.match(uploadModal, /form\.set\('assetIds', JSON\.stringify\(\[assetId\]\)\)/);
  assert.match(uploadModal, /Describe the document in Notes when choosing Other document/);
  assert.match(uploadModal, /This link cannot be removed during quick add/);
  assert.match(uploadModal, /await onUploaded\(uploaded, \{ complete: false, totalUploaded:/);
  assert.match(uploadModal, /busyRef\.current = true;[\s\S]*?setBusy\(true\)/);
  assert.match(client, /setVaultDocumentsByAssetId\(\(current\) =>/);
  assert.match(client, /if \(!outcome\.complete\) return;[\s\S]*?closeAssetDocumentUpload\(asset\.id\)/);

  for (const label of [
    'Registration certificate / NaTIS',
    'Insurance schedule / certificate',
    'Finance agreement',
    'Invoice / proof of purchase',
    'Service invoice / service record',
    'Inspection report',
  ]) {
    assert.match(documentTypes, new RegExp(label.replaceAll('/', '\\/')));
  }
});

test('percentage usage is rendered without the word worked', () => {
  const formatter = client.slice(
    client.indexOf('function formatUsagePercent'),
    client.indexOf('function buildAssetUsageValue'),
  );

  assert.match(formatter, /return `\$\{formatted\}%`/);
  assert.doesNotMatch(formatter, /worked/i);
  assert.match(client, /value: 'percentage', label: '%'/);
  assert.match(client, /showPercentUsageField[\s\S]*?\? 'Usage %'/);
  assert.match(client, /projectionUsageMetaLabel = projectionUsageMetric === 'percent' \? 'Usage %'/);
  assert.doesNotMatch(client, /label: '% worked'|Lifetime worked %|Enter lifetime worked %|Worked %|current worked percentage/);
});

test('a failed Vault load waits for the visible Retry action instead of looping', () => {
  const errorGuard = client.indexOf('if (vaultDocumentsErrorByAssetId[expandedAssetId]) return;');
  const loadEffect = client.slice(
    client.lastIndexOf('useEffect(() => {', errorGuard),
    client.indexOf('useEffect(() => {', errorGuard),
  );

  assert.ok(errorGuard >= 0, 'expected a failed-load guard');
  assert.match(loadEffect, /if \(vaultDocumentsErrorByAssetId\[expandedAssetId\]\) return;/);
  assert.match(client, /<button type="button" onClick=\{\(\) => \{ void loadVaultDocuments\(asset\.id\); \}\}>Retry<\/button>/);
});

test('card detail values truncate on one line and preserve their full value', () => {
  assert.match(styles, /\.assetDetailRow > strong\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(styles, /\.assetDocumentsCardShell\s*\{[\s\S]*?position:\s*relative;/);
  assert.match(client, /<strong title=\{title\}>\{displayedValue\}<\/strong>/);
  assert.match(client, /renderAssetDetailRow\('usage', 'Usage', buildAssetUsageValue\(asset\)\)/);
  assert.match(client, /conditionLabel\(asset\.condition\) \|\| 'Not provided'/);
});

test('owner detail rows open the existing update form at the selected field', () => {
  const quickEditor = client.slice(
    client.indexOf('function openQuickAssetDetailEditor'),
    client.indexOf('function setAssetSettingsManualLocationInputsFromAsset'),
  );
  const detailRows = client.slice(
    client.indexOf('const renderAssetDetailRow ='),
    client.indexOf('<div className={styles.assetStatusDetails}>', client.indexOf('const renderAssetDetailRow =')),
  );

  assert.match(quickEditor, /if \(!canUseOwnerOnlyAssetActions \|\| !canQuickEditAssetDetail\(asset, target\)\) return;/);
  assert.match(quickEditor, /setExpandedAssetId\(asset\.id\);/);
  assert.match(quickEditor, /openUpdater\(asset, target\);/);
  assert.match(detailRows, /<button[\s\S]*?styles\.assetDetailRowButton/);
  assert.match(detailRows, /onClick=\{\(event\) => openQuickAssetDetailEditor\(asset, target, event\.currentTarget\)\}/);
  assert.match(detailRows, /aria-label=\{`Edit \$\{label\.toLowerCase\(\)\} for \$\{asset\.title\}/);
  assert.doesNotMatch(detailRows, /EditIcon|assetDetailEditIcon/);
  assert.match(detailRows, /renderAssetDetailRow\('serial'/);
  assert.match(detailRows, /renderAssetDetailRow\([\s\S]*?'year'/);
  assert.match(detailRows, /renderAssetDetailRow\('usage'/);
  assert.match(detailRows, /renderAssetDetailRow\([\s\S]*?'condition'/);
});

test('quick detail editing scrolls and focuses the matching step-two control', () => {
  const focusEffect = client.slice(
    client.indexOf('if (!isAssetModalOpen || manualAssetStep !== 2 || !assetDetailFocusTarget)'),
    client.indexOf('useEffect(() => {', client.indexOf('if (!isAssetModalOpen || manualAssetStep !== 2 || !assetDetailFocusTarget)') + 1),
  );

  for (const target of ['serial', 'year', 'usage', 'condition']) {
    assert.match(client, new RegExp(`data-asset-detail-edit-target=[{\"](?:assetDetailEditTarget|${target})`));
  }
  assert.match(focusEffect, /field\.scrollIntoView\(\{ behavior: 'smooth', block: 'center', inline: 'nearest' \}\);/);
  assert.match(focusEffect, /focusControl\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(client, /const savedUsageReading = getAssetSavedUsageReading\(editingAsset\);/);
  assert.match(client, /LIFETIME_PERCENT_SETTINGS_ERROR/);
});

test('detail rows provide more room without pen icons', () => {
  assert.match(styles, /\.assetDetailRow\s*\{\s*grid-template-columns:\s*minmax\(7\.5rem, 0\.82fr\) minmax\(0, 1fr\);/);
  assert.match(styles, /\.assetDetailRow span\s*\{\s*padding:\s*0 1rem;/);
  assert.doesNotMatch(client, /function EditIcon|<EditIcon/);
  assert.doesNotMatch(styles, /\.assetDetailEditIcon/);
});

test('closing asset modals restores the previous card or Manage action', () => {
  const closeFlow = client.slice(
    client.indexOf('function rememberAssetModalReturn'),
    client.indexOf('function openUpdater'),
  );
  const syncFlow = client.slice(
    client.indexOf('function syncUpdatedAsset'),
    client.indexOf('function syncSettingsUpdatedAsset'),
  );

  assert.match(closeFlow, /origin: AssetModalReturnOrigin\['origin'\]/);
  assert.match(closeFlow, /setExpandedAssetId\(returnOrigin\.assetId\)/);
  assert.match(closeFlow, /scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/);
  assert.match(closeFlow, /focus\(\{ preventScroll: true \}\)/);
  assert.match(closeFlow, /returnOrigin\.origin === 'manage'/);
  assert.match(closeFlow, /openActionDialog\(latestAsset\)/);
  assert.match(client, /data-asset-return-action="manage-update"/);
  assert.match(syncFlow, /setAssets\(\(current\) => current\.map/);
  assert.doesNotMatch(syncFlow, /setCurrentPage\(1\)/);
  assert.match(client, /function closeAssetDocumentUpload[\s\S]*?setExpandedAssetId\(assetId\)/);
  assert.match(uploadModal, /returnFocusRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
});

test('document upload keeps the footer visible and scrolls only its content', () => {
  assert.match(uploadModalStyles, /\.modal\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\);/);
  assert.match(uploadModalStyles, /\.modal form\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) auto;[\s\S]*?overflow:\s*hidden;/);
  assert.match(uploadModalStyles, /\.content\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?max-height:\s*none;[\s\S]*?overflow-y:\s*auto;/);
  assert.match(uploadModalStyles, /\.footer\s*\{[\s\S]*?padding:\s*1rem 1\.45rem max\(1\.3rem, env\(safe-area-inset-bottom\)\);/);
  assert.doesNotMatch(uploadModalStyles, /calc\(92dvh - 11\.5rem\)|calc\(96dvh - 12rem\)/);
});

test('scrollbar drags do not trigger outside-click closing', () => {
  const umbrellaHandler = client.slice(
    client.indexOf('function handleOutsideUmbrellaPointerDown'),
    client.indexOf("document.addEventListener('pointerdown', handleOutsideUmbrellaPointerDown)"),
  );
  const headerHandler = header.slice(
    header.indexOf('function handleDocumentClick'),
    header.indexOf('function handleEscape'),
  );

  assert.match(umbrellaHandler, /if \(isViewportScrollbarInteraction\(event\)\) return;/);
  assert.match(headerHandler, /if \(isViewportScrollbarInteraction\(event\)\)/);
});

test('asset modals preserve the open umbrella and its expanded View details card', () => {
  const handlerIndex = client.indexOf('function handleOutsideUmbrellaPointerDown');
  const umbrellaEffect = client.slice(
    client.lastIndexOf('useEffect(() => {', handlerIndex),
    client.indexOf('useEffect(() => {', handlerIndex),
  );

  assert.match(
    umbrellaEffect,
    /if \(!focusedAssetGroupId \|\| anyModalOpen \|\| documentUploadAsset\) return undefined;/,
  );
  assert.match(
    umbrellaEffect,
    /\}, \[anyModalOpen, documentUploadAsset, focusedAssetGroupId\]\);/,
  );
  assert.match(client, /Boolean\(activeAsset\)[\s\S]*?isQuoteModalOpen/);
  assert.match(client, /const \[documentUploadAsset, setDocumentUploadAsset\]/);
});

test('dropdowns reserve scrollbar space only when content is clipped', () => {
  assert.match(styles, /\.customSelectMenuPortal\s*\{[\s\S]*?scrollbar-gutter:\s*auto !important;/);
  assert.match(headerStyles, /\.accountPopover\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 7rem\);[\s\S]*?scrollbar-gutter:\s*auto;/);
  assert.doesNotMatch(headerStyles, /max-height:\s*min\(36rem, calc\(100dvh - 7rem\)\)/);
});
