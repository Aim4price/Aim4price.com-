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
  assert.match(overview, /<strong>Overview<\/strong>/);
  assert.match(overview, /<strong>Assets<\/strong>/);
  assert.match(overview, /overviewViewIcon\(\)/);
  assert.match(overview, /assetsViewIcon\(\)/);
  assert.match(overview, /REGISTER_VIEW_STORAGE_KEY/);
  assert.match(overview, /window\.sessionStorage\.setItem/);
  assert.match(styles, /\.viewSwitch/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.viewSwitchButtonActive/);
  assert.match(styles, /\.viewSwitchIcon/);
  assert.match(styles, /\.viewSwitchCopy/);
});

test('switching views updates the existing asset workspace immediately without rewriting it', () => {
  assert.match(overview, /function syncAssetViewSiblings/);
  assert.match(overview, /host\.nextElementSibling/);
  assert.match(overview, /sibling\.hidden = true/);
  assert.match(overview, /assetRegisterOverviewManaged/);
  assert.match(overview, /syncAssetViewSiblings\(portalHost, nextView === 'assets'\)/);
  assert.match(overview, /activeView === 'assets'/);
  assert.match(overview, /activeView === 'overview'/);
  assert.match(overview, /restoreManagedAssetViewSiblings/);
});

test('overview starts directly with asset update cards and avoids extra heading or pill-heavy chrome', () => {
  assert.doesNotMatch(overview, /Needs attention &amp; coming up/);
  assert.doesNotMatch(overview, /Maintenance, licence renewals and notes across standalone assets/);
  assert.doesNotMatch(overview, /overviewHeader/);
  assert.doesNotMatch(overview, /overviewSummary/);
  assert.doesNotMatch(overview, /overviewEyebrow/);
  assert.doesNotMatch(overview, /cardBadges/);
  assert.doesNotMatch(overview, /typeBadge/);
  assert.doesNotMatch(overview, /umbrellaBadge/);
  assert.doesNotMatch(overview, /statusBadge/);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assert.match(overview, /className=\{styles\.cardContext\}/);
  assert.match(overview, /<section className=\{styles\.overview\} aria-label="Asset Register overview">/);
});

test('view switch communicates useful counts without bringing the pill strip back', () => {
  assert.match(overview, /overviewSwitchDetail/);
  assert.match(overview, /assetSwitchDetail/);
  assert.match(overview, /need attention/);
  assert.match(overview, /Loading register…/);
  assert.doesNotMatch(styles, /\.viewSwitchCount/);
});

test('Overview hides the normal asset workspace and ends with Go to assets instead', () => {
  assert.match(overview, /syncAssetViewSiblings\(portalHost, activeView === 'assets'\)/);
  assert.match(overview, /sibling\.hidden = true/);
  assert.match(overview, /sibling\.style\.setProperty\('display', 'none', 'important'\)/);
  assert.match(overview, /assetRegisterOverviewDisplayPriority/);
  assert.match(overview, /restoreManagedAssetViewElement/);
  assert.match(overview, /style\.removeProperty\('display'\)/);
  assert.match(overview, /<div className=\{styles\.overviewFooter\}>[\s\S]*?<strong>Go to assets<\/strong>/);
  assert.match(overview, /onClick=\{goToAssets\}/);
  assert.match(overview, /selectView\('assets'\)/);
  assert.match(overview, /portalHost\?\.scrollIntoView/);
  assert.match(styles, /\.goToAssetsButton/);
  assert.match(styles, /\.goToAssetsIcon/);
  assert.match(styles, /\.goToAssetsCopy/);
  assert.doesNotMatch(overview, /INITIAL_VISIBLE_ITEMS/);
  assert.doesNotMatch(overview, /showMoreButton/);
  assert.doesNotMatch(overview, /Show \d+ more/);
});

test('overview keeps Asset Register card styling with loading, error and responsive states', () => {
  assert.match(overview, /registerStyles\.assetCard/);
  assert.match(styles, /\.overviewCard,[\s\S]*?\.stateCard/);
  assert.match(styles, /border-radius: 1\.5rem/);
  assert.match(styles, /background: linear-gradient\(180deg, rgba\(255, 255, 255, 0\.98\)/);
  assert.match(styles, /\.cardAttention/);
  assert.match(styles, /\.cardUpcoming/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(overview, /Checking the register/);
  assert.match(overview, /Overview unavailable/);
  assert.match(overview, /Nothing needs attention right now/);
});
