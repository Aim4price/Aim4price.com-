import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const workspace = read('lib/accountant-workspace.ts');
const lifecycle = read('lib/asset-lifecycle.ts');
const accountantUi = read('app/accountant/registers/[shareId]/accountant-register-client.tsx');
const ownerUi = read('app/asset-register/asset-register-client.tsx');
const registerDb = read('lib/asset-register-db.ts');
const registerSummaries = read('lib/asset-registers.ts');
const migration = read('database/migrations/65-accountant-workspace-and-asset-lifecycle.sql');

test('accountant access is tied to the signed-in partner and an active share', () => {
  assert.match(workspace, /l\.partner_user_id = \$2/);
  assert.match(workspace, /l\.access_status = 'active'/);
  assert.match(workspace, /l\.access_removed_at is null/);
  assert.match(workspace, /account_subtype.*accountant/s);
});

test('unauthorised assets cannot escape the shared register boundary', () => {
  assert.match(workspace, /asset\.registerId !== access\.registerId/);
  assert.match(workspace, /ACCOUNTANT_ASSET_NOT_FOUND/);
});

test('direct finance, accounting value and document writes require owner permission', () => {
  assert.match(workspace, /requireWrite && !access\.allowDirectUpdates/);
  assert.equal((workspace.match(/authorisedAsset\([^\n]+true\)/g) || []).length >= 3, true);
});

test('accountant removal ends only the lead access record', () => {
  const removal = workspace.slice(workspace.indexOf('export async function removeAccountantRegisterAccess'), workspace.indexOf('export async function syncAccountantShareSettingsFromLead'));
  assert.match(removal, /update public\.asset_leads/);
  assert.doesNotMatch(removal, /delete from public\.asset_register_items|delete from public\.asset_registers/);
});

test('accountant asset UI exposes no owner deletion, marketplace or pricing controls', () => {
  assert.doesNotMatch(accountantUi, /Delete asset|Send to marketplace|Manage pricing|Add Asset|Dealer tracking/);
  assert.match(accountantUi, /Finance/);
  assert.match(accountantUi, /Documents/);
  assert.match(accountantUi, /Accounting value/);
});

test('genuine disposals archive while duplicate mistakes use the delete path', () => {
  assert.match(lifecycle, /hardDelete = input\.reason === 'mistake_duplicate'/);
  assert.match(lifecycle, /set lifecycle_state = 'disposed'/);
  assert.match(lifecycle, /deleteAssetRegisterItem\(input\.ownerUserId, asset\.id\)/);
  assert.match(lifecycle, /asset_snapshot_json/);
});

test('disposed assets are excluded from active rows and register totals', () => {
  assert.match(registerDb, /coalesce\(lifecycle_state, 'active'\) = 'active'/);
  assert.equal((registerSummaries.match(/coalesce\(ai\.lifecycle_state, 'active'\) = 'active'/g) || []).length >= 4, true);
});

test('manual owner entry captures newly acquired details separately', () => {
  assert.match(ownerUi, /Is this a newly acquired asset\?/);
  assert.match(ownerUi, /acquisitionAmountExVat/);
  assert.match(ownerUi, /Acquisition details/);
  assert.match(lifecycle, /eventType = input\.newlyAcquired \? 'acquired' : 'existing_added'/);
});

test('migration is additive, idempotent and keeps values separate', () => {
  assert.match(migration, /add column if not exists lifecycle_state/);
  assert.match(migration, /create table if not exists public\.asset_lifecycle_events/);
  assert.match(migration, /create table if not exists public\.asset_accounting_values/);
  assert.match(migration, /carrying_value numeric/);
  assert.doesNotMatch(migration, /drop table|truncate table/);
});
