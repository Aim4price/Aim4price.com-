import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');
const assetMapClient = readFileSync(new URL('../app/asset-map/asset-map-client.tsx', import.meta.url), 'utf8');
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

test('owner Manage keeps disposal and mapping inside the gated ten-action command grid', () => {
  const ownerManage = client.slice(
    client.indexOf('styles.ownerCommandOverlay'),
    client.indexOf('{activeAsset && ownerAssetCommandPanel', client.indexOf('styles.ownerCommandOverlay')),
  );

  for (const label of [
    'Update asset',
    'Reports',
    'Add cost',
    'Add fuel',
    'Maintenance',
    'Manage pricing',
    'Asset map',
    'Map asset',
    'QR code',
    'Marketplace',
    'Dispose or remove asset',
  ]) {
    assert.match(ownerManage, new RegExp(label.replace('&amp;', '&amp;')));
  }

  assert.equal(ownerManage.match(/styles\.ownerCommandAction/g)?.length, 10);
  assert.ok(ownerManage.indexOf('Update asset') < ownerManage.indexOf('Reports'));
  assert.ok(ownerManage.indexOf('Reports') < ownerManage.indexOf('Add cost'));
  assert.ok(ownerManage.indexOf('Manage pricing') < ownerManage.indexOf('Asset map'));
  assert.ok(ownerManage.indexOf('Asset map') < ownerManage.indexOf('QR code'));
  assert.doesNotMatch(ownerManage, /Documents &amp; photos|manage-documents/);
  assert.match(ownerManage, /canAssetReceiveFuel\(activeAsset\)[\s\S]*?buildOwnerAssetPageHref\('\/fuel'/);
  assert.match(ownerManage, /canManageAssetPricing\(activeAsset\)/);
  assert.match(ownerManage, /canUseMarketplaceActions && isMarketplaceEligible\(activeAsset\)/);
  assert.match(ownerManage, /ownerCommandGrid[\s\S]*?Marketplace[\s\S]*?ownerCommandDangerAction[\s\S]*?Dispose or remove asset/);
  assert.doesNotMatch(ownerManage, /ownerCommandDangerZone/);
  assert.doesNotMatch(ownerManage, /Dealer tracking settings|Remove from marketplace/);
  assert.match(client, /<AccountantAssetManageModal/);
});

test('Manage uses concise update copy and a dedicated recalculate icon', () => {
  const ownerManage = client.slice(
    client.indexOf('styles.ownerCommandOverlay'),
    client.indexOf('{activeAsset && ownerAssetCommandPanel', client.indexOf('styles.ownerCommandOverlay')),
  );
  const pricingOptions = client.slice(
    client.indexOf('<div className={styles.pricingOptionsGrid}>'),
    client.indexOf('</div>', client.indexOf('<div className={styles.pricingOptionsGrid}>') + 1),
  );
  const recalculateOption = pricingOptions.slice(
    pricingOptions.indexOf('openRevalueGuidedDialog'),
    pricingOptions.indexOf('openProjectionModal'),
  );

  assert.match(ownerManage, /Edit details, documents and photos\./);
  assert.doesNotMatch(ownerManage, /Edit details, documents, photos and status\./);
  assert.match(recalculateOption, /<RecalculateIcon className=\{styles\.buttonIcon\}/);
  assert.match(client, /function RecalculateIcon[\s\S]*?<path d="M4 9V4h5" \/>/);
});

test('Manage routes mapped assets to a focused map and unmapped assets to location setup', () => {
  const coordinateGuard = client.slice(
    client.indexOf('function hasAssetGpsCoordinates'),
    client.indexOf('function formatAssetSettingsLastScanned'),
  );
  const settingsCloseFlow = client.slice(
    client.indexOf('function closeAssetSettingsModal'),
    client.indexOf('function openAssetSettingsMenuView'),
  );
  const ownerManage = client.slice(
    client.indexOf('styles.ownerCommandOverlay'),
    client.indexOf('{activeAsset && ownerAssetCommandPanel', client.indexOf('styles.ownerCommandOverlay')),
  );

  assert.match(coordinateGuard, /Math\.abs\(latitude\) > 90 \|\| Math\.abs\(longitude\) > 180/);
  assert.match(coordinateGuard, /return latitude !== 0 \|\| longitude !== 0/);
  assert.match(coordinateGuard, /`\/asset-map\?assetId=\$\{encodeURIComponent\(asset\.id\)\}`/);
  assert.match(ownerManage, /window\.location\.assign\(buildFocusedAssetMapHref\(asset\)\)/);
  assert.match(ownerManage, /rememberAssetModalReturn\(asset, 'manage', 'manage-map-location', event\.currentTarget\)/);
  assert.match(ownerManage, /openAssetSettingsModalForAsset\(asset, 'location'\)/);
  assert.match(ownerManage, /Add a GPS location\./);
  assert.match(settingsCloseFlow, /\['status-mapped', 'manage-map-location'\]\.includes/);
  assert.match(settingsCloseFlow, /returnOrigin\?\.origin === 'manage'/);
  assert.match(settingsCloseFlow, /openActionDialog\(latestAsset\)/);
});

test('Manage map setup is a focused workflow without the Settings back button', () => {
  const settingsModal = client.slice(
    client.indexOf('{isAssetSettingsModalOpen && editingAsset ?'),
    client.indexOf('{activeAsset && isAccountantWorkspace', client.indexOf('{isAssetSettingsModalOpen && editingAsset ?')),
  );
  const directMapStylesStart = styles.indexOf('/* Focused Map Asset flow opened from the Manage modal. */');
  const directMapStyles = styles.slice(
    directMapStylesStart,
    styles.indexOf('/* === Cost budget warning state === */', directMapStylesStart),
  );

  assert.match(client, /const isManageMapLocationFlow = assetModalReturnRef\.current\?\.origin === 'manage'[\s\S]*?assetModalReturnRef\.current\.action === 'manage-map-location'/);
  assert.match(settingsModal, /styles\.assetSettingsMapEntryModal/);
  assert.match(settingsModal, /\{isManageMapLocationFlow \? 'Map asset' : 'Settings'\}/);
  assert.match(settingsModal, /assetSettingsView !== 'menu' && !\(isManageMapLocationFlow && assetSettingsView === 'location'\)/);
  assert.doesNotMatch(settingsModal, /Choose how to map this asset/);
  assert.match(settingsModal, /Use current location/);
  assert.match(settingsModal, /Choose on map/);
  assert.match(settingsModal, /Enter coordinates/);
  assert.match(settingsModal, /View on asset map/);
  assert.doesNotMatch(settingsModal, />Asset map</);
  assert.doesNotMatch(settingsModal, />Map status</);
  assert.doesNotMatch(settingsModal, /Pick one simple method below/);
  assert.doesNotMatch(settingsModal, /Choose an option below to place it on your Asset Map/);
  assert.doesNotMatch(settingsModal, /Best when you are standing near the asset/);
  assert.doesNotMatch(settingsModal, /Find the place visually and drop a pin/);
  assert.doesNotMatch(settingsModal, /Paste a latitude and longitude from another source/);
  assert.match(settingsModal, /!isManageMapLocationFlow \? <span className=\{styles\.assetSettingsRecommendedBadge\}>Recommended<\/span> : null/);
  assert.match(settingsModal, /window\.location\.assign\(buildFocusedAssetMapHref\(editingAsset\)\)/);
  assert.match(directMapStyles, /\.assetSettingsMapEntryModal\.assetSettingsLocationModal \.assetSettingsLocationSection\s*\{[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent !important;/);
  assert.match(directMapStyles, /\.assetSettingsMapEntryModal\.assetSettingsLocationModal \.assetSettingsLocationChoiceGrid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;/);
  assert.match(directMapStyles, /\.assetSettingsMapEntryModal\.assetSettingsLocationModal \.assetSettingsLocationChoiceGrid \.assetSettingsLocationPrimaryChoice\s*\{[\s\S]*?grid-column:\s*auto !important;/);
  assert.doesNotMatch(directMapStyles, /assetSettingsMapHeroIcon/);
  assert.doesNotMatch(directMapStyles, /text-transform:\s*uppercase/);
  assert.match(directMapStyles, /\.assetSettingsMapEntryModal \.assetSettingsMapAssetButton\s*\{/);
});

test('Asset Map selects the asset requested by the Manage action', () => {
  const initialLoad = assetMapClient.slice(
    assetMapClient.indexOf('const requestedAssetId'),
    assetMapClient.indexOf('} catch (error)', assetMapClient.indexOf('const requestedAssetId')),
  );

  assert.match(initialLoad, /new URLSearchParams\(window\.location\.search\)\.get\("assetId"\)/);
  assert.match(initialLoad, /data\.assets\.find\(\(asset\) => asset\.id === requestedAssetId && hasCoordinates\(asset\)\)/);
  assert.match(initialLoad, /setSelectedRegisterId\(ALL_REGISTER_FILTER_ID\)/);
  assert.match(initialLoad, /setSelectedCode\(requestedAsset\.publicAssetCode\)/);
});

test('owner command layout is three columns wide, two medium and one mobile', () => {
  const dangerActionRule = styles.slice(
    styles.indexOf('.ownerCommandDangerAction {'),
    styles.indexOf('.ownerCommandDangerAction > .buttonIcon'),
  );

  assert.match(styles, /\.optionsModal\.ownerCommandModal\s*\{[\s\S]*?width:\s*min\(97vw, 84rem\) !important;/);
  assert.match(styles, /\.ownerCommandModal \.ownerCommandGrid\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\) !important;/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*?\.ownerCommandModal \.ownerCommandGrid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.ownerCommandModal \.ownerCommandGrid,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) !important;/);
  assert.match(styles, /\.ownerCommandScrollBody\.optionsScrollBody\s*\{[\s\S]*?overflow-y:\s*auto !important;[\s\S]*?scrollbar-gutter:\s*auto !important;/);
  assert.match(styles, /\.optionsModal\.ownerCommandModal\s*\{[\s\S]*?overflow:\s*hidden !important;/);
  assert.match(styles, /@media \(min-width: 901px\)[\s\S]*?\.ownerCommandModal \.ownerCommandGrid \.ownerCommandAction small,[\s\S]*?white-space:\s*nowrap !important;/);
  assert.match(dangerActionRule, /width:\s*100%;[\s\S]*?min-height:\s*6\.25rem;/);
  assert.doesNotMatch(dangerActionRule, /grid-column/);
  assert.doesNotMatch(styles, /\.ownerCommandDangerZone/);
});

test('cross-page asset actions carry add intent and a safe exact-register return path', () => {
  const hrefBuilder = client.slice(
    client.indexOf('function buildAssetRegisterManageReturnPath'),
    client.indexOf('function isValuationUpdateAvailable'),
  );
  const mapReturn = client.slice(
    client.indexOf("const action = params.get('mapAction')"),
    client.indexOf('}, [assets, isLoading]);', client.indexOf("const action = params.get('mapAction')")),
  );

  assert.match(hrefBuilder, /new URL\(currentLocation, 'https:\/\/aim4price\.local'\)/);
  assert.match(hrefBuilder, /new URLSearchParams\(currentUrl\.search\)/);
  assert.match(hrefBuilder, /params\.set\('assetId', assetId\)/);
  assert.match(hrefBuilder, /params\.set\('mapAction', 'manage'\)/);
  assert.match(hrefBuilder, /if \(options\.add\) params\.set\('add', '1'\)/);
  assert.match(hrefBuilder, /params\.set\('returnTo', buildAssetRegisterManageReturnPath\(assetId, currentLocation\)\)/);
  assert.match(client, /setOwnerCommandReturnLocation\(`\$\{window\.location\.pathname\}\$\{window\.location\.search\}`\)/);
  for (const route of ['/my-invoices', '/fuel', '/maintenance']) {
    assert.match(client, new RegExp(`buildOwnerAssetPageHref\\('${route.replace('/', '\\/')}'`));
  }
  assert.match(mapReturn, /nextParams\.delete\('assetId'\)/);
  assert.match(mapReturn, /nextParams\.delete\('mapAction'\)/);
  assert.match(mapReturn, /nextSearch \? `\?\$\{nextSearch\}` : ''/);
});

test('fuel action mirrors the server eligibility contract and hides unknown equipment', () => {
  const fuelGate = client.slice(
    client.indexOf('function canAssetReceiveFuel'),
    client.indexOf('function buildAssetRegisterManageReturnPath'),
  );

  assert.match(fuelGate, /asset\.kind === 'tractor' \|\| asset\.kind === 'vehicle'/);
  for (const key of ['is_propelled', 'isPropelled', 'self_propelled', 'selfPropelled', 'accepts_fuel', 'acceptsFuel']) {
    assert.match(fuelGate, new RegExp(`'${key}'`));
  }
  assert.match(fuelGate, /return readBooleanFromSpecs/);
  assert.doesNotMatch(fuelGate, /kind !== 'property'/);
});

test('nested marketplace actions close back to Manage', () => {
  const marketplaceOpen = client.slice(
    client.indexOf('async function openMarketplaceModal'),
    client.indexOf('function closeMarketplaceModal'),
  );
  const marketplaceRemove = client.slice(
    client.indexOf('async function handleRemoveFromMarketplace'),
    client.indexOf('function clearRevaluePreviewResult'),
  );

  assert.doesNotMatch(marketplaceOpen, /closeActionDialog\(\)/);
  assert.match(marketplaceRemove, /closeMarketplaceModal\(\)/);
  assert.doesNotMatch(marketplaceRemove, /closeActionDialog\(\)/);
  assert.match(client, /marketplaceAsset && marketplaceDraft[\s\S]*?styles\.subModalOverlay/);
  assert.match(client, /Remove listing/);
  assert.match(client, /`\[data-asset-return-action="\$\{returnOrigin\.action\}"\]`/);
});

test('successful asset reports close only the report child and preserve Manage', () => {
  const reportSuccessFlows = client.slice(
    client.indexOf('async function handlePrintAssetSheet'),
    client.indexOf('async function handleDownloadQr'),
  );

  assert.doesNotMatch(reportSuccessFlows, /closeActionDialog\(\)/);
  assert.equal(reportSuccessFlows.match(/closeAssetReportDialog\(\)/g)?.length, 7);
  assert.match(reportSuccessFlows, /if \(!didOpen\)[\s\S]*?return;[\s\S]*?closeAssetReportDialog\(\);[\s\S]*?async function handleCopyScanLink/);
  assert.match(reportSuccessFlows, /message: `\$\{reportLabel\} Excel downloaded\.` \}\);[\s\S]*?closeAssetReportDialog\(\);/);

  for (const reportKind of ['fuel', 'maintenance', 'depreciation']) {
    const handlerName = reportKind === 'depreciation'
      ? 'handleDownloadFilteredDepreciationReport'
      : `handleDownloadFiltered${reportKind[0].toUpperCase()}${reportKind.slice(1)}Report`;
    const handlerStart = reportSuccessFlows.indexOf(`async function ${handlerName}`);
    const handlerEnd = reportSuccessFlows.indexOf('\n  async function ', handlerStart + 1);
    const handler = reportSuccessFlows.slice(handlerStart, handlerEnd < 0 ? undefined : handlerEnd);
    assert.match(handler, /if \(didOpen\) \{\s*closeAssetReportDialog\(\);\s*\}/);
    assert.doesNotMatch(handler, /closeActionDialog\(\)/);
  }

  const ownershipHandler = reportSuccessFlows.slice(
    reportSuccessFlows.indexOf('async function handleDownloadFilteredOwnershipReport'),
  );
  assert.equal(ownershipHandler.match(/closeAssetReportDialog\(\)/g)?.length, 2);
  assert.doesNotMatch(ownershipHandler, /closeActionDialog\(\)/);
});
