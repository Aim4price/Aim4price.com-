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

test('upload validation and orphan cleanup protect storage', () => {
  assert.match(collectionRoute, /isAllowedAssetRegisterDocument\(fileEntry\)/);
  assert.match(collectionRoute, /MAX_ASSET_REGISTER_DOCUMENT_UPLOAD_BYTES/);
  assert.match(collectionRoute, /removeUnusedAccountDocumentUpload\(owner\.userId, savedUploadId\)/);
  assert.match(documentStore, /not exists \([\s\S]*?public\.account_documents document/);
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

test('Documents appears only in the owner account dropdown', () => {
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
  assert.doesNotMatch(ownerNavigation, /href: '\/documents'/);
  assert.doesNotMatch(accountMenus, /href: '\/', label: 'Home'/);
  assert.doesNotMatch(footer, /href: '\/documents', label: 'Documents'/);
  assert.match(header, /navItems\.filter\(\(item\) => item\.href !== '\/'\)/);
});

test('the account dropdown scrolls when its actions exceed the viewport', () => {
  assert.match(headerStyles, /\.accountPopover\s*\{[\s\S]*?max-height:\s*min\(36rem, calc\(100dvh - 7rem\)\)/);
  assert.match(headerStyles, /overflow-y:\s*auto/);
  assert.match(headerStyles, /overscroll-behavior:\s*contain/);
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
  assert.match(styles, /\.hero h1\s*\{[\s\S]*?font-size:\s*clamp\(2\.35rem, 4\.15vw, 3\.55rem\)/);
  assert.match(styles, /\.hero h1\s*\{[\s\S]*?font-weight:\s*900/);
  assert.match(styles, /\.topActions\s*\{[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.recycleButton\s*\{[\s\S]*?#fff0e3/);
  assert.match(styles, /\.summaryButton\s*\{[\s\S]*?#eaf5ff/);
  assert.match(styles, /--header-action-light-green-bg:\s*#ecf9f1/);
  assert.match(styles, /\.filtersButton\s*\{[\s\S]*?--header-action-light-green-bg/);
  assert.match(styles, /\.primaryHeaderButton\s*\{[\s\S]*?--header-action-dark-green-top/);
  assert.match(styles, /\.summaryGrid\s*\{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.documentCard\s*\{[\s\S]*?rgba\(198, 216, 223, 0\.98\)/);
  assert.doesNotMatch(styles, /comingSoon/i);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('internal server errors do not leak implementation details to vault clients', () => {
  assert.match(collectionRoute, /\{ ok: false, error: fallback \}/);
  assert.doesNotMatch(collectionRoute, /!message\.includes\('DOCUMENT_'\)/);
});
