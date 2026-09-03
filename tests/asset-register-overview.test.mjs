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
  assert.match(overview, /item\.umbrellaName \|\| 'Standalone asset'/);
  assert.match(overview, /assetId: asset\.id/);
});

test('Overview and Assets switch sits under summary cards and keeps Assets as the safe default', () => {
  assert.match(overview, /document\.querySelector<HTMLElement>\(`\.\$\{registerStyles\.toolbar\}`\)/);
  assert.match(overview, /parent\.insertBefore\(host, toolbar\)/);
  assert.match(overview, /createPortal\(/);
  assert.match(overview, /useState<RegisterContentView>\('assets'\)/);
  assert.match(overview, />Overview</);
  assert.match(overview, />Assets</);
  assert.match(overview, /REGISTER_VIEW_STORAGE_KEY/);
  assert.match(overview, /window\.sessionStorage\.setItem/);
  assert.match(styles, /\.viewSwitch/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.viewSwitchButtonActive/);
});

test('switching to Overview hides the existing asset workspace without touching its implementation', () => {
  assert.match(overview, /function syncAssetViewSiblings/);
  assert.match(overview, /host\.nextElementSibling/);
  assert.match(overview, /sibling\.hidden = true/);
  assert.match(overview, /assetRegisterOverviewManaged/);
  assert.match(overview, /activeView === 'assets'/);
  assert.match(overview, /activeView === 'overview'/);
  assert.match(overview, /restoreManagedAssetViewSiblings/);
});

test('overview removes the small uppercase label and pill-heavy badge treatment', () => {
  assert.doesNotMatch(overview, /overviewEyebrow/);
  assert.doesNotMatch(overview, /cardBadges/);
  assert.doesNotMatch(overview, /typeBadge/);
  assert.doesNotMatch(overview, /umbrellaBadge/);
  assert.doesNotMatch(overview, /statusBadge/);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assert.match(overview, /className=\{styles\.cardContext\}/);
  assert.match(overview, /className=\{styles\.overviewSummary\}/);
});

test('overview keeps Asset Register card styling with loading, error and responsive states', () => {
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
