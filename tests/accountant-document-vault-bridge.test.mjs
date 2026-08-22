import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [workspace, collectionRoute, downloadRoute, ownerCollectionRoute] = await Promise.all([
  readFile(new URL('../lib/accountant-workspace.ts', import.meta.url), 'utf8'),
  readFile(
    new URL('../app/api/accountant/registers/[shareId]/assets/[assetId]/documents/route.ts', import.meta.url),
    'utf8',
  ),
  readFile(
    new URL(
      '../app/api/accountant/registers/[shareId]/assets/[assetId]/documents/[documentId]/download/route.ts',
      import.meta.url,
    ),
    'utf8',
  ),
  readFile(new URL('../app/api/documents/route.ts', import.meta.url), 'utf8'),
]);

test('accountant document reads stay inside the active shared register and canonical Vault', () => {
  assert.match(workspace, /authorised\.asset\.registerId !== authorised\.access\.registerId/);
  assert.match(workspace, /export async function listAccountantAssetDocuments/);
  assert.match(workspace, /authorisedSharedDocumentAsset\([\s\S]*?input\.accountantUserId[\s\S]*?input\.shareId[\s\S]*?input\.assetId/);
  assert.match(workspace, /listAccountDocuments\(access\.ownerUserId, \{ assetId: asset\.id \}\)/);
  assert.match(workspace, /assetLinks: document\.assetLinks\.filter\(\(link\) => link\.id === asset\.id\)/);
  assert.match(collectionRoute, /export async function GET/);
  assert.match(collectionRoute, /getServerSession\(\)/);
  assert.match(collectionRoute, /listAccountantAssetDocuments/);
  assert.match(collectionRoute, /NextResponse\.json\(\{ ok: true, documents \}\)/);
});

test('accountant Vault uploads require write access and a specific type before bytes are stored', () => {
  const uploadFunction = workspace.slice(
    workspace.indexOf('export async function uploadAccountantDocument'),
    workspace.indexOf('export async function updateAccountantAssetFlag'),
  );
  const typeValidation = uploadFunction.indexOf('getAccountDocumentType(input.documentType)');
  const byteWrite = uploadFunction.indexOf('createAssetRegisterUpload({');

  assert.match(uploadFunction, /authorisedSharedDocumentAsset\([\s\S]*?true/);
  assert.ok(typeValidation >= 0, 'expected document type validation');
  assert.ok(byteWrite > typeValidation, 'document type must be validated before file storage');
  assert.ok(
    uploadFunction.indexOf("documentType.value === 'other'") < byteWrite,
    'Other-document notes must be validated before file storage',
  );
  assert.match(uploadFunction, /MAX_DOCUMENT_VAULT_UPLOAD_BYTES/);
  assert.match(uploadFunction, /userId: access\.ownerUserId/);
  assert.match(uploadFunction, /category: 'account-document'/);
  assert.match(uploadFunction, /createAccountDocument\(access\.ownerUserId/);
  assert.match(uploadFunction, /category: documentType\.category/);
  assert.match(uploadFunction, /documentType: documentType\.value/);
  assert.match(uploadFunction, /assetIds: \[asset\.id\]/);
});

test('accountant uploads create one canonical document without appending embedded asset documents', () => {
  const uploadFunction = workspace.slice(
    workspace.indexOf('export async function uploadAccountantDocument'),
    workspace.indexOf('export async function updateAccountantAssetFlag'),
  );

  assert.match(uploadFunction, /insert into public\.asset_accountant_documents/);
  assert.match(uploadFunction, /'accountant_document_uploaded'/);
  assert.match(uploadFunction, /Promise\.allSettled/);
  assert.ok(
    uploadFunction.indexOf('getAccountingValue(access.ownerUserId, asset.id)') < uploadFunction.indexOf('createAssetRegisterUpload({'),
    'fallible response context must be resolved before the canonical write',
  );
  assert.match(uploadFunction, /savedUploadId = '';[\s\S]*?Promise\.allSettled/);
  assert.match(uploadFunction, /removeUnusedAccountDocumentUpload\(access\.ownerUserId, savedUploadId\)/);
  assert.doesNotMatch(uploadFunction, /updateAssetRegisterItemMedia/);
  assert.doesNotMatch(uploadFunction, /asset\.documents/);
  assert.doesNotMatch(uploadFunction, /documents:\s*\[/);
  assert.match(uploadFunction, /item: \{ \.\.\.asset, accountingValue \}/);
  assert.match(uploadFunction, /\bdocument,\s*\n\s*\};/);
});

test('accountant upload route accepts Vault metadata and returns both updated context and document', () => {
  assert.match(collectionRoute, /documentType: form\.get\('documentType'\)/);
  assert.match(collectionRoute, /title: form\.get\('title'\)/);
  assert.match(collectionRoute, /notes: form\.get\('notes'\)/);
  assert.match(collectionRoute, /expiryDate: form\.get\('expiryDate'\)/);
  assert.match(collectionRoute, /\{ ok: true, item: result\.item, document: result\.document \}/);
  assert.match(collectionRoute, /\{ status: 201 \}/);
});

test('delegated downloads prove owner scope and the exact asset link before resolving bytes', () => {
  const downloadFunction = workspace.slice(
    workspace.indexOf('export async function resolveAccountantAssetDocumentDownload'),
    workspace.indexOf('export async function uploadAccountantDocument'),
  );
  const ownerLookup = downloadFunction.indexOf('getAccountDocument(access.ownerUserId, input.documentId)');
  const assetLinkCheck = downloadFunction.indexOf('document?.assetLinks.some((link) => link.id === asset.id)');
  const referenceLookup = downloadFunction.indexOf('getAccountDocumentUploadReference(access.ownerUserId, document.id)');
  const byteRead = downloadFunction.indexOf('resolveAssetRegisterUploadBytes(reference.uploadId)');

  assert.match(downloadFunction, /authorisedSharedDocumentAsset/);
  assert.ok(ownerLookup >= 0, 'expected owner-scoped document lookup');
  assert.ok(assetLinkCheck > ownerLookup, 'expected explicit asset-link verification');
  assert.ok(referenceLookup > assetLinkCheck, 'upload reference must follow the link check');
  assert.ok(byteRead > referenceLookup, 'bytes must resolve only after all metadata checks');
  assert.match(downloadFunction, /document\.deletedAtIso/);
  assert.match(downloadRoute, /resolveAccountantAssetDocumentDownload/);
  assert.match(downloadRoute, /'Cache-Control': 'private, no-store'/);
  assert.match(downloadRoute, /'X-Content-Type-Options': 'nosniff'/);
});

test('the main Document Vault remains owner-only', () => {
  assert.match(ownerCollectionRoute, /getAccountProfile\(session\.user\)/);
  assert.match(ownerCollectionRoute, /profile\.accountType !== 'owner'/);
  assert.match(ownerCollectionRoute, /Document Vault is only available to owner accounts/);
});
