import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [
  page,
  client,
  styles,
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
  assert.match(sharedUploadRoute, /session\.user\.id !== documentOwnerUserId/);
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

test('owner navigation exposes Documents across desktop, mobile and footer surfaces', () => {
  assert.match(header, /\| 'documents'/);
  assert.match(header, /key: 'documents', href: '\/documents', label: 'Documents'/);
  assert.match(header, /case 'documents':/);
  assert.match(header, /href: '\/documents', label: 'Documents', accountTypes: \['owner'\]/);
  assert.match(footer, /href: '\/documents', label: 'Documents'/);
});

test('visual treatment follows the Asset Register card language and remains responsive', () => {
  assert.match(client, /<AppHeader active="documents"/);
  assert.match(client, /Document Vault/);
  assert.match(client, /summaryGrid/);
  assert.match(client, /categoryGroup/);
  assert.match(client, /documentCard/);
  assert.match(styles, /\.hero\s*\{/);
  assert.match(styles, /\.summaryGrid\s*\{/);
  assert.match(styles, /\.categoryGroup\s*\{/);
  assert.match(styles, /\.documentCard\s*\{/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
