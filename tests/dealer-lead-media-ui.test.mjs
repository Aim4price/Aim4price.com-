import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function read(repoPath) {
  const actual = path.join(root, repoPath);
  const fallback = path.join(root, 'validation', repoPath);
  return fs.readFileSync(fs.existsSync(actual) ? actual : fallback, 'utf8');
}

test('dealer lead management exposes QR and Photos in both dealer surfaces', () => {
  const leads = read('app/leads/leads-client.tsx');
  const dealerPage = read('app/dealer/leads/page.tsx');

  assert.match(leads, /isDealerLeadsMode = Boolean\(dealerAppMode \|\| dealerWorkspaceMode\)/);
  assert.match(leads, /<strong>QR code<\/strong>/);
  assert.match(leads, /<strong>Photos<\/strong>/);
  assert.match(leads, /openLeadQrModal\(managedLead\)/);
  assert.match(leads, /openLeadPhotoUploadModal\(managedLead\)/);
  assert.match(dealerPage, /<LeadsClient[\s\S]*dealerAppMode/);
});

test('dealer QR reuses the owner QR experience and partner-scoped renderer', () => {
  const leads = read('app/leads/leads-client.tsx');
  const qrRoute = read('app/api/asset-register/qr/route.ts');

  assert.match(leads, /assetStyles\.qrModal/);
  assert.match(leads, /Permanent asset QR/);
  assert.match(leads, /Copy scan link/);
  assert.match(leads, /Print QR label/);
  assert.match(leads, /Download QR/);
  assert.match(qrRoute, /getServerSession\(\{ allowDealerApp: true \}\)/);
  assert.match(qrRoute, /getAssetLeadForPartner/);
  assert.match(qrRoute, /lead\.assetRegisterItemId !== assetId/);
  assert.match(qrRoute, /getAssetRegisterItemById\(assetOwnerUserId, assetId\)/);
});

test('photo upload validates images and writes to the owner asset plus lead snapshot', () => {
  const leads = read('app/leads/leads-client.tsx');
  const route = read('app/api/asset-leads/[leadId]/media/route.ts');
  const access = read('lib/partner-access.ts');

  assert.match(leads, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(leads, /formData\.append\('files', photo\.file\)/);
  assert.match(route, /getAssetLeadForPartner/);
  assert.match(route, /MAX_ASSET_REGISTER_PHOTOS/);
  assert.match(route, /ALLOWED_ASSET_REGISTER_IMAGE_TYPES/);
  assert.match(route, /MAX_ASSET_REGISTER_UPLOAD_BYTES/);
  assert.match(route, /createAssetRegisterUpload\(\{[\s\S]*userId: access\.lead\.ownerUserId/);
  assert.match(route, /updateAssetRegisterItemMedia\(access\.lead\.ownerUserId/);
  assert.match(route, /updateAssetLeadPhotosForPartner/);
  assert.match(access, /partner_user_id = \$2/);
  assert.match(access, /jsonb_set\([\s\S]*'\{photos\}'/);
});
