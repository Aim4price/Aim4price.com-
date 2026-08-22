import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [
  page,
  client,
  styles,
  headerStyles,
  collectionRoute,
  itemRoute,
  downloadRoute,
  sharedUploadRoute,
  documentStore,
  migration,
  documentTaxonomy,
  documentTypeMigration,
  header,
  footer,
  accountDeletion,
] = await Promise.all([
  readFile(new URL('../app/documents/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/documents/documents-client.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../app/documents/page.module.css', import.meta.url), 'utf8'),
  readFile(new URL('../components/AppHeader.module.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/documents/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/documents/[documentId]/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/documents/[documentId]/download/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/asset-register/uploads/[uploadId]/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../lib/account-documents.ts', import.meta.url), 'utf8'),
  readFile(new URL('../database/migrations/82-account-document-vault.sql', import.meta.url), 'utf8'),
  readFile(new URL('../lib/account-document-taxonomy.ts', import.meta.url), 'utf8'),
  readFile(new URL('../database/migrations/86-account-document-types.sql', import.meta.url), 'utf8'),
  readFile(new URL('../components/AppHeader.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/AppFooter.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../lib/account-deletion.ts', import.meta.url), 'utf8'),
]);

test('Document Vault page and every API entry point require an owner account', () => {
  assert.match(page, /requireActivePageAccess\(\)/);
  assert.match(page, /profile\.accountType !== 'owner'/);

  for (const route of [collectionRoute, itemRoute, downloadRoute]) {
    assert.match(route, /getServerSession\(\)/);
    assert.match(route, /getAccountProfile\(session\.user\)/);
    assert.match(route, /profile\.accountType !== 'owner'/);
  }
});

test('vault metadata is owner-scoped and file bytes stay in the existing upload catalog', () => {
  assert.match(migration, /create table if not exists public\.account_documents/i);
  assert.match(migration, /upload_id text not null/i);
  assert.match(migration, /create table if not exists public\.account_document_asset_links/i);
  assert.doesNotMatch(migration, /\bdata\s+bytea\b/i);
  assert.match(collectionRoute, /createAssetRegisterUpload\(/);
  assert.match(collectionRoute, /category: 'account-document'/);
  assert.match(documentStore, /where user_id = \$1/g);
  assert.match(documentStore, /asset\.user_id = document\.user_id/);
});

test('download proves document ownership before resolving shared upload bytes', () => {
  const ownershipCheck = downloadRoute.indexOf('getAccountDocumentUploadReference(session.user.id, documentId)');
  const byteRead = downloadRoute.indexOf('resolveAssetRegisterUploadBytes(reference.uploadId)');

  assert.ok(ownershipCheck >= 0, 'expected an owner-scoped metadata lookup');
  assert.ok(byteRead > ownershipCheck, 'upload bytes must be resolved only after ownership');
  assert.match(downloadRoute, /Cache-Control': 'private, no-store'/);
  assert.doesNotMatch(client, /\/api\/asset-register\/uploads\//);
  assert.match(sharedUploadRoute, /getAccountDocumentUploadOwner\(uploadId\)/);
  assert.match(sharedUploadRoute, /if \(documentOwnerUserId\) \{[\s\S]*?status: 404/);
  assert.doesNotMatch(sharedUploadRoute, /session\.user\.id !== documentOwnerUserId/);
  assert.match(sharedUploadRoute, /Cache-Control': 'private, no-store'/);
  assert.match(sharedUploadRoute, /return new NextResponse\('Not found', \{ status: 404 \}\)/);
});

test('documents may stay account-level or link to multiple owned assets', () => {
  assert.match(documentStore, /unnest\(\$2::text\[\]\)/);
  assert.match(documentStore, /assertOwnedAssetIds/);
  assert.match(documentStore, /id::text = any\(\$2::text\[\]\)/);
  assert.match(client, /Account-level document/);
  assert.match(client, /Link to assets/);
  assert.match(client, /choose one or more related assets/i);
});

test('specific document types use one shared searchable taxonomy and canonical broad categories', () => {
  for (const documentType of [
    'licence-disc',
    'registration-certificate',
    'roadworthy-certificate',
    'insurance-policy',
    'finance-agreement',
    'settlement-letter',
    'invoice-proof-of-purchase',
    'service-record',
    'inspection-report',
    'valuation-report',
    'warranty-certificate',
    'other',
  ]) {
    assert.match(documentTaxonomy, new RegExp(`value: '${documentType}'`));
  }

  assert.match(documentTaxonomy, /value: 'service-record'[\s\S]*?category: 'other'/);
  assert.match(client, /ACCOUNT_DOCUMENT_TYPES/);
  assert.match(client, /type="search"[\s\S]*?placeholder="Search document types"/);
  assert.match(client, /role="combobox"/);
  assert.match(client, /event\.composedPath\(\)\.includes\(documentTypeComboboxRef\.current\)/);
  assert.doesNotMatch(client, /onBlur=\{\(\) => window\.setTimeout\(\(\) => setShowDocumentTypeOptions/);
  assert.match(client, /getAccountDocumentTypeLabel\(document\.documentType\)/);
});

test('asset-linked uploads require and persist a valid document type before file storage', () => {
  const typeValidation = collectionRoute.indexOf('assetIds.length && !hasDocumentType');
  const uploadWrite = collectionRoute.indexOf('createAssetRegisterUpload({');

  assert.ok(typeValidation >= 0, 'expected asset-linked document type validation');
  assert.ok(uploadWrite > typeValidation, 'document type must be validated before file storage');
  assert.match(collectionRoute, /isAccountDocumentType\(documentTypeEntry\)/);
  assert.match(collectionRoute, /documentType: documentTypeEntry/);
  assert.match(documentStore, /required: assetIds\.length > 0/);
  assert.match(documentStore, /document_type/);
  assert.match(documentTypeMigration, /add column if not exists document_type text/i);
  assert.match(documentTypeMigration, /document_type is null/);
  assert.match(documentTypeMigration, /validate constraint account_documents_document_type_check/i);
});

test('Other document requires a meaningful description before bytes are stored', () => {
  const descriptionValidation = collectionRoute.indexOf("documentTypeEntry === 'other'");
  const uploadWrite = collectionRoute.indexOf('createAssetRegisterUpload({');

  assert.ok(descriptionValidation >= 0, 'expected an Other-document description check');
  assert.ok(uploadWrite > descriptionValidation, 'description must be validated before file storage');
  assert.match(collectionRoute, /Describe the document in Notes when choosing Other document/);
  assert.match(documentStore, /documentType === 'other' && !notes/);
  assert.match(itemRoute, /DOCUMENT_DESCRIPTION_REQUIRED/);
  assert.match(client, /draft\.documentType === 'other' && !draft\.notes\.trim\(\)/);
});

test('asset query links open an owner-scoped filtered vault and preselect uploads', () => {
  assert.match(page, /searchParams\?:[\s\S]*?assetId\?: string \| string\[\]/);
  assert.match(page, /<DocumentsClient initialAssetId=\{initialAssetId\}/);
  assert.match(collectionRoute, /searchParams\.get\('assetId'\)/);
  assert.match(collectionRoute, /listAccountDocuments\(owner\.userId, \{ includeDeleted, assetId \}\)/);
  assert.match(documentStore, /filtered_link\.document_id = account_documents\.id/);
  assert.match(documentStore, /filtered_link\.asset_id = \$2/);
  assert.match(client, /searchParams\.set\('assetId', initialAssetId\)/);
  assert.match(client, /className=\{styles\.assetFilterBanner\}/);
  assert.match(client, /assetIds: initialAssetId \? \[initialAssetId\] : \[\]/);
  assert.match(client, /modalMode === 'upload' && initialAssetId/);
  assert.match(client, /className=\{styles\.lockedAssetLink\}/);
  assert.match(client, /This link is fixed for the asset-card upload/);
  assert.match(styles, /\.assetFilterBanner\s*\{/);
  assert.match(styles, /\.lockedAssetLink\s*\{/);
});

test('upload validation and orphan cleanup protect storage', () => {
  assert.match(collectionRoute, /isAllowedAssetRegisterDocument\(fileEntry\)/);
  assert.match(collectionRoute, /MAX_DOCUMENT_VAULT_UPLOAD_BYTES/);
  assert.match(collectionRoute, /isAccountDocumentCategory\(categoryEntry\)/);
  assert.ok(collectionRoute.indexOf('isAccountDocumentCategory(categoryEntry)') < collectionRoute.indexOf('createAssetRegisterUpload({'));
  assert.match(collectionRoute, /removeUnusedAccountDocumentUpload\(owner\.userId, savedUploadId\)/);
  assert.match(collectionRoute, /savedUploadId = '';[\s\S]*?getAccountDocumentSummary\(owner\.userId\)\.catch/);
  assert.match(documentStore, /not exists \([\s\S]*?public\.account_documents document/);
  assert.match(documentStore, /throw new Error\('DOCUMENT_CATEGORY_INVALID'\)/);
  assert.match(itemRoute, /message === 'DOCUMENT_CATEGORY_INVALID'/);
});

test('Document Vault accepts larger files and uploads a validated batch sequentially', () => {
  assert.match(client, /MAX_DOCUMENT_FILES_PER_BATCH = 20/);
  assert.match(client, /MAX_DOCUMENT_FILE_BYTES = 25 \* 1024 \* 1024/);
  assert.match(client, /MAX_DOCUMENT_BATCH_BYTES = 250 \* 1024 \* 1024/);
  assert.match(client, /type="file"[\s\S]*?multiple/);
  assert.match(client, /for \(let index = 0; index < filesToUpload\.length; index \+= 1\)/);
  assert.match(client, /Uploading \$\{uploadProgress\.current\} of \$\{uploadProgress\.total\}/);
  assert.match(client, /setSelectedFiles\(failedFiles\)/);
  assert.match(client, /titleFromFileName\(file\.name\) \|\| file\.name/);
  assert.match(client, /Drop documents here or browse/);
});

test('empty-vault onboarding removes zero-value controls and foregrounds core categories', () => {
  assert.match(client, /showSummary && view === 'documents'[\s\S]*?summary\.totalDocuments > 0/);
  assert.match(client, /hasDocumentsInView \? <section className=\{styles\.toolbar\}/);
  assert.match(client, /Keep every important document in one place/);
  assert.match(client, /Finance/);
  assert.match(client, /Accounting &amp; tax/);
  assert.match(client, /Licences &amp; permits/);
  assert.match(client, /account-level by default/i);
  assert.match(client, /showAssetPicker && assets\.length/);
});

test('Recycle Bin keeps recoverable documents for 90 days and purges expired uploads', () => {
  assert.match(migration, /90-day recycle-bin state/i);
  assert.match(documentStore, /deleted_at <= now\(\) - interval '90 days'/);
  assert.match(documentStore, /deleted_at > now\(\) - interval '90 days'/);
  assert.match(documentStore, /delete from public\.asset_register_uploads/);
  assert.match(documentStore, /delete from public\.asset_register_bucket_uploads/);
  assert.match(client, /90-day Recycle Bin/);
  assert.match(client, /action: 'restore'/);
  assert.match(accountDeletion, /'account_documents'/);
});

test('Documents follows Cost Ledger in owner navigation and remains in the owner dropdown', () => {
  const ownerNavigation = header.slice(
    header.indexOf('const OWNER_NAV_ITEMS'),
    header.indexOf('const ACCOUNT_MENU_ITEMS'),
  );
  const accountMenus = header.slice(
    header.indexOf('const ACCOUNT_MENU_ITEMS'),
    header.indexOf('const ACCOUNT_MENU_COLLATOR'),
  );

  assert.match(header, /\| 'documents'/);
  assert.match(header, /case 'documents':/);
  assert.match(header, /href: '\/documents', label: 'Documents', accountTypes: \['owner'\]/);
  assert.match(ownerNavigation, /href: '\/my-invoices', label: 'Cost Ledger' \},\s*\{ key: 'documents', href: '\/documents', label: 'Documents' \}/);
  assert.doesNotMatch(accountMenus, /href: '\/', label: 'Home'/);
  assert.doesNotMatch(footer, /href: '\/documents', label: 'Documents'/);
  assert.match(header, /navItems\.filter\(\(item\) => item\.href !== '\/'\)/);
});

test('the account dropdown scrolls when its actions exceed the viewport', () => {
  assert.match(headerStyles, /\.accountPopover\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 7rem\)/);
  assert.match(headerStyles, /overflow-y:\s*auto/);
  assert.match(headerStyles, /overscroll-behavior:\s*contain/);
  assert.match(headerStyles, /scrollbar-gutter:\s*auto/);
  assert.doesNotMatch(headerStyles, /max-height:\s*min\(36rem, calc\(100dvh - 7rem\)\)/);
});

test('Documents activates the full vault with the Asset Register visual system', () => {
  assert.match(page, /import DocumentsClient from '.\/documents-client'/);
  assert.match(page, /<DocumentsClient/);
  assert.doesNotMatch(page, /ComingSoon/);
  assert.match(client, /<AppHeader active="documents"/);
  assert.match(client, /id="document-vault-title">Document Vault/);
  assert.match(client, /Recycle Bin/);
  assert.match(client, /Summary/);
  assert.match(client, /Filters/);
  assert.match(client, /Upload document/);
  assert.match(styles, /\.shell\s*\{[\s\S]*?1320px/);
  assert.match(styles, /\.vaultCanvas\s*\{[\s\S]*?padding:\s*clamp\(1\.15rem, 1\.9vw, 1\.7rem\)/);
  assert.match(styles, /\.hero h1\s*\{[\s\S]*?font-size:\s*clamp\(2\.35rem, 4\.15vw, 3\.55rem\)/);
  assert.match(styles, /\.hero h1\s*\{[\s\S]*?font-weight:\s*900/);
  assert.match(styles, /\.topActions\s*\{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.recycleButton\s*\{[\s\S]*?#fff0e3/);
  assert.match(styles, /\.summaryButton\s*\{[\s\S]*?#eaf5ff/);
  assert.match(styles, /--header-action-light-green-bg:\s*#ecf9f1/);
  assert.match(styles, /\.filtersButton\s*\{[\s\S]*?--header-action-light-green-bg/);
  assert.match(styles, /\.primaryHeaderButton\s*\{[\s\S]*?--header-action-dark-green-top/);
  assert.match(client, /summaryViewportRef/);
  assert.match(client, /scrollSummary\(-1\)/);
  assert.match(client, /scrollSummary\(1\)/);
  assert.match(client, /hasOverflow:\s*maxScrollLeft > 2/);
  assert.match(client, /disabled=\{!summaryNavigation\.hasOverflow \|\| summaryNavigation\.atStart\}/);
  assert.match(client, /disabled=\{!summaryNavigation\.hasOverflow \|\| summaryNavigation\.atEnd\}/);
  assert.match(client, /hidden=\{!summaryNavigation\.hasOverflow\}/);
  assert.match(styles, /\.summaryViewport\s*\{[\s\S]*?scroll-snap-type:\s*x mandatory/);
  assert.match(styles, /flex:\s*0 0 calc\(\(100% - \(var\(--summary-gap\) \* 2\)\) \/ 3\)/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*?flex-basis:\s*calc\(\(100% - var\(--summary-gap\)\) \/ 2\)/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?flex-basis:\s*100%/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.summaryNav\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /\.documentCard\s*\{[\s\S]*?rgba\(198, 216, 223, 0\.98\)/);
  assert.doesNotMatch(styles, /comingSoon/i);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('internal server errors do not leak implementation details to vault clients', () => {
  assert.match(collectionRoute, /\{ ok: false, error: fallback \}/);
  assert.doesNotMatch(collectionRoute, /!message\.includes\('DOCUMENT_'\)/);
});

test('live vault interactions keep errors, focus and view mutations safe', () => {
  assert.match(client, /setModalNotice\(\{ tone: 'error'/);
  assert.match(client, /className=\{styles\.modalNotice\} role="alert"/);
  assert.match(client, /pageContent\?\.setAttribute\('inert', ''\)/);
  assert.match(client, /event\.key !== 'Tab'/);
  assert.match(client, /returnFocusRef\.current\?\.focus\(\)/);
  assert.match(client, /const previousOverflow = document\.body\.style\.overflow/);
  assert.match(client, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(client, /event\.key === 'Escape' && showDocumentTypeOptions/);
  assert.match(client, /event\.stopPropagation\(\)/);
  assert.match(client, /<fieldset className=\{styles\.modalFields\} disabled=\{busy\}>/);
  assert.match(client, /role="status" aria-live="polite"/);
  assert.match(client, /async function readVaultResponse/);
  assert.match(client, /setOperationBusy\(false\);\s*setModalMode\(null\);/);
  assert.match(client, /disabled=\{busy \|\| loading\}/);
  assert.match(client, /disabled=\{loading \|\| busy\}/);
  assert.match(client, /className=\{styles\.fileName\}/);
  assert.match(styles, /\.fileMeta \.fileName\s*\{[\s\S]*?text-overflow:\s*ellipsis/);
  assert.match(styles, /\.filePicker:focus-within/);
  assert.match(styles, /\.assetOptions label:focus-within/);
  assert.match(client, /showSummary && view === 'documents' && !loading && !loadFailed/);
});
