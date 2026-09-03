import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const page = read('app/asset-register/page.tsx');
const overview = read('app/asset-register/asset-register-overview.tsx');
const styles = read('app/asset-register/asset-register-overview.module.css');

test('Asset Register mounts the quick overview for owner and dealer register workspaces', () => {
  assert.match(page, /import AssetRegisterOverview from "\.\/asset-register-overview"/);
  assert.ok((page.match(/<AssetRegisterOverview \/>/g) ?? []).length >= 4);
  assert.match(page, /<DealerRegisterGateway/);
});

test('quick overview reuses the existing Asset Register alert payload', () => {
  assert.match(overview, /fetch\(`\/api\/asset-register\$\{suffix\}`/);
  assert.match(overview, /latestIssueNoteStatus/);
  assert.match(overview, /maintenanceAlert/);
  assert.match(overview, /licenseRenewalAlert/);
  assert.match(overview, /openPartnerNote/);
  assert.match(overview, /latestMaintenanceStatus/);
  assert.match(overview, /status === 'overdue' \|\| status === 'due'/);
  assert.match(overview, /sectionForAlert\(maintenance\.computedStatus\)/);
  assert.match(overview, /sectionForAlert\(licence\.computedStatus\)/);
});

test('umbrella member alerts stay visible without expanding the umbrella', () => {
  assert.match(overview, /group\.members\.forEach/);
  assert.match(overview, /umbrellaByAssetId\.set\(member\.assetId, group\.name\)/);
  assert.match(overview, /Umbrella · \{item\.umbrellaName\}/);
  assert.match(overview, /Standalone asset/);
});

test('overview is inserted after register summary and before the existing toolbar', () => {
  assert.match(overview, /document\.querySelector<HTMLElement>\(`\.\$\{registerStyles\.toolbar\}`\)/);
  assert.match(overview, /parent\.insertBefore\(host, toolbar\)/);
  assert.match(overview, /createPortal\(/);
});

test('overview uses Asset Register card styling with loading, error and responsive states', () => {
  assert.match(overview, /registerStyles\.assetCard/);
  assert.match(styles, /\.overviewCard,[\s\S]*?\.stateCard/);
  assert.match(styles, /border-radius: 1\.5rem/);
  assert.match(styles, /background: linear-gradient\(180deg, rgba\(255, 255, 255, 0\.98\)/);
  assert.match(styles, /\.cardAttention/);
  assert.match(styles, /\.cardUpcoming/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(overview, /Checking the register/);
  assert.match(overview, /Overview unavailable/);
  assert.match(overview, /Nothing needs attention right now/);
});
