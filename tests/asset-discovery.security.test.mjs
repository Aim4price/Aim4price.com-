import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const discovery = read("lib/asset-discovery.ts");
const migration = read(
  "database/migrations/60-owner-discovery-participation.sql",
);
const client = read("app/asset-discovery/asset-discovery-client.tsx");
const css = read("app/asset-discovery/page.module.css");
const photoRoute = read(
  "app/api/asset-discovery/assets/[assetId]/photos/[photoIndex]/route.ts",
);
const header = read("components/AppHeader.tsx");
const discoveryPage = read("app/asset-discovery/page.tsx");
const discoveryRoute = read("app/api/asset-discovery/route.ts");
const marketplaceClient = read("app/marketplace/marketplace-client.tsx");
const marketplaceEntry = read("app/marketplace/page.tsx");
const ownerAppHome = read("app/owner-app/page.tsx");
const photoViewer = read("components/LeadPhotoViewerModal.tsx");
const dealerCss = read("app/dealer/dealer.module.css");
const dealerDiscoveryPage = read("app/dealer/discovery/page.tsx");
const ownerDiscoveryPage = read("app/owner-app/discovery/page.tsx");

test("owner participation defaults to off", () => {
  assert.match(
    migration,
    /discovery_participation_enabled boolean not null default false/,
  );
});

test("opted-out owner assets are excluded from all list queries", () => {
  assert.match(
    discovery,
    /"owner\.discovery_participation_enabled = true"/,
  );
});

test("eligible opted-in owners can browse and owners without assets cannot", () => {
  assert.match(
    discovery,
    /count\(eligible_asset\.id\)::int as eligible_asset_count/,
  );
  assert.match(discovery, /canBrowse: reason === "allowed"/);
  assert.match(discovery, /eligibleAssetCount < 1/);
});

test("owners cannot see or enquire on their own assets", () => {
  assert.match(discovery, /"asset\.user_id <> \$1"/);
  assert.match(discovery, /and asset\.user_id <> \$2/);
});

test("owner enquiries use generalized requester identity", () => {
  assert.match(migration, /requester_user_id text/);
  assert.match(migration, /requester_account_type text/);
  assert.match(discovery, /requesterAccountType: "owner" \| "dealer"/);
  assert.match(discovery, /requesterContact/);
});

test("approved owner enquiries expose each party's permitted contact only to the other party", () => {
  assert.match(
    discovery,
    /audience === "target_owner" && isApproved[\s\S]*requesterContact/,
  );
  assert.match(
    discovery,
    /audience === "requester" && isApproved[\s\S]*ownerContact/,
  );
  assert.match(discovery, /requesterAccountType === "dealer" \? requesterContact : null/);
});

test("locked list responses do not select photos or owner private fields", () => {
  const listSql = discovery.slice(
    discovery.indexOf("const listSql = `"),
    discovery.indexOf("const assetRows =", discovery.indexOf("const listSql = `")),
  );
  const projection = listSql.slice(0, listSql.indexOf("from public.asset_register_items"));
  assert.doesNotMatch(
    projection,
    /asset\.photos|owner\.user_id|owner\.phone|serial|registration|valuation|documents/i,
  );
});

test("locked cards render a static placeholder without a private image", () => {
  const lockedBlock = client.slice(
    client.indexOf('className={styles.discoveryLockedMedia}'),
    client.indexOf("discoveryInlineContact"),
  );
  assert.match(lockedBlock, /No private image was sent/);
  assert.doesNotMatch(lockedBlock, /<img/);
});

test("detail loading supports legacy photo column names without exposing them in list responses", () => {
  assert.match(discovery, /to_jsonb\(asset\)->'photos'/);
  assert.match(discovery, /to_jsonb\(asset\)->'photo_urls'/);
  assert.match(discovery, /to_jsonb\(asset\)->'image_urls'/);
  assert.match(discovery, /to_jsonb\(asset\)->'images'/);
  assert.match(photoRoute, /context\.params\.photoIndex/);
  assert.match(photoRoute, /getAssetDiscoveryPhoto/);
});

test("dealer photos unlock through active approval or an exact direct share", () => {
  assert.match(discovery, /approvedEnquiry \|\| access\.dealerShare/);
  assert.match(discovery, /lead\.partner_user_id = \$3/);
  assert.match(discovery, /access\.dealer_user_id = \$3/);
  assert.match(discovery, /access\.is_active = true/);
});

test("a share with one dealer cannot unlock another dealer", () => {
  assert.match(
    discovery,
    /\[input\.asset\.id, input\.asset\.owner_user_id, input\.viewerUserId\]/,
  );
});

test("expired, retracted and revoked access cannot unlock photos", () => {
  assert.match(discovery, /enquiryStatus === "approved"/);
  assert.match(discovery, /activeApproval\(/);
  assert.match(
    discovery,
    /status in \('pending', 'approved', 'temporarily_denied', 'retracted', 'expired', 'revoked'\)/,
  );
});

test("owner opt-out immediately revokes active Discovery enquiries", () => {
  assert.match(discovery, /set status = 'revoked'/);
  assert.match(discovery, /owner_user_id = \$1 or requester_user_id = \$1/);
});

test("active 90-day denials remain visible only to a denied requester", () => {
  assert.match(
    discovery,
    /viewer_denial\.requester_user_id = \$1[\s\S]*viewer_denial\.status = 'temporarily_denied'/,
  );
  assert.match(client, /discoveryAssetCardDenied/);
  assert.match(css, /\.discoveryAssetCardDenied/);
});

test("owner settings can disable participation without deleting Asset Register records", () => {
  assert.match(client, />Settings</);
  assert.match(client, /Disable & remove assets/);
  assert.match(client, /Nothing[\s\S]*is deleted from your Asset Register/);
  assert.match(client, /updateOwnerDiscoveryParticipation\(false\)/);
});

test("participation explains request-based contact privacy and exclusions", () => {
  assert.match(client, /No contact details are shared immediately/);
  assert.match(client, /Property, land and buildings/);
  assert.match(client, /Manual or unclassified entries/);
  assert.match(client, /Tools and small loose equipment/);
});

test("existing active dealer Discovery remains supported", () => {
  assert.match(discovery, /account_type = 'dealer'/);
  assert.match(discovery, /requester_account_type.*'dealer'/s);
});

test("Refresh remains white in every interaction state", () => {
  for (const state of [
    ".discoveryRefreshButton,",
    ".discoveryRefreshButton:hover",
    ".discoveryRefreshButton:focus",
    ".discoveryRefreshButton:active",
    ".discoveryRefreshButton:disabled",
  ]) {
    assert.ok(css.includes(state), `missing ${state}`);
  }
  assert.match(css, /background: #ffffff !important/);
});

test("owner and dealer Discovery follow the Overview layout", () => {
  assert.match(client, /styles\.compactAppSurface/);
  assert.match(client, /mobileStyles\.overviewIntro/);
  assert.match(client, /mobileStyles\.overviewSearch/);
  assert.match(client, /mobileStyles\.overviewSectionHeading/);
  assert.match(client, /mobileStyles\.overviewList/);
  assert.match(client, /mobileStyles\.overviewCard/);
  assert.match(client, /styles\.discoveryFilterRow/);
  assert.match(client, /"Available assets"/);
  assert.match(dealerDiscoveryPage, /<AssetDiscoveryClient dealerAppMode \/>/);
  assert.match(ownerDiscoveryPage, /<AssetDiscoveryClient ownerAppMode \/>/);
  assert.match(css, /\.discoveryOverviewIntro/);
  assert.match(css, /\.discoverySectionHeading/);
  assert.match(client, /isExpanded \? styles\.discoveryCloseButton/);
  assert.match(client, /styles\.discoveryCloseDetailsButton/);
  assert.match(client, /closeButtonClassName=\{styles\.discoveryPhotoCloseButton\}/);
  assert.match(photoViewer, /closeButtonClassName\?: string/);
  assert.match(css, /\.compactAppSurface \.toolbar/);
  assert.match(css, /\.compactAppSurface \.discoveryDetailsGrid/);
  assert.match(css, /\.discoveryCloseButton/);
  assert.match(css, /\.discoveryPhotoCloseButton/);
  assert.match(css, /background: linear-gradient\(180deg, #cf4e4e 0%, #a92f2f 100%\)/);
});

test("dealer Discovery Open actions use the visible Overview treatment", () => {
  assert.match(client, /styles\.discoveryOverviewOpenButton/);
  assert.match(css, /\.compactAppSurface \.discoveryOverviewOpenButton/);
  assert.match(
    css,
    /background: linear-gradient\(180deg, #ffffff 0%, #e6f8ef 100%\) !important/,
  );
  assert.match(
    dealerCss,
    /\.dealerDiscoverySurface \[class\*='discoveryOverviewOpenButton'\]/,
  );
  assert.match(dealerCss, /color: #0a543d !important/);
});

test("desktop navigation exposes Discovery directly only to licensing accounts", () => {
  const navigationConfig = header.slice(
    header.indexOf("const BASE_NAV_ITEMS"),
    header.indexOf("function isAccountMenuItemVisible"),
  );

  assert.match(navigationConfig, /href:\s*['"]\/asset-discovery['"], label: ['"]Discovery['"], accountTypes: \[['"]licensing['"]\]/);
  assert.match(marketplaceEntry, /href="\/asset-discovery"/);
  assert.match(marketplaceEntry, /href="\/marketplace\/browse"/);
});

test("Discovery and Marketplace pages do not render the old switch", () => {
  assert.doesNotMatch(client, /DiscoveryMarketplaceSwitch/);
  assert.doesNotMatch(marketplaceClient, /DiscoveryMarketplaceSwitch/);
});

test("approved notification opens the matching Discovery card", () => {
  assert.match(
    header,
    /href=\{`\/asset-discovery\?openAsset=\$\{encodeURIComponent\(enquiry\.assetId\)\}`\}/,
  );
  assert.match(header, /isApproved && Boolean\(enquiry\.ownerContact\)/);
  assert.match(discoveryPage, /initialOpenAssetId=/);
  assert.match(discoveryRoute, /focusAssetId: searchParams\.get\("focusAssetId"\)/);
  assert.match(discovery, /focusOrderSql/);
  assert.match(client, /void toggleAssetDetails\(requestedAsset\)/);
  assert.match(client, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});

test("Owner App keeps direct separate Discovery and Marketplace buttons", () => {
  assert.match(ownerAppHome, /href:\s*['"]\/owner-app\/discovery['"]/);
  assert.match(ownerAppHome, /href:\s*['"]\/owner-app\/marketplace['"]/);
});

test("licensing Discovery includes every valid renewal date and keeps the pipeline visible", () => {
  const licensingEligibility = discovery.slice(
    discovery.indexOf("const LICENSING_DISCOVERY_ASSET_SQL"),
    discovery.indexOf("const PROVINCE_ABBREVIATION_SQL"),
  );
  assert.match(licensingEligibility, /SAFE_LICENSE_RENEWAL_DATE_SQL} is not null/);
  assert.doesNotMatch(licensingEligibility, /120 days|30 days/);
  assert.match(discovery, /renewalTiming === 'later'/);
  assert.match(discovery, /requestedStatus === 'available'/);
  assert.match(discovery, /requester_account_type = 'licensing' and e\.status in \('approved', 'temporarily_denied'\) then true/);
  assert.match(client, /label: "All renewal dates"/);
  assert.match(client, /label: "Won"/);
  assert.match(client, /label: "Denied"/);
  assert.match(client, /statusPillLabel\(asset, true\)/);
  assert.match(css, /\.discoveryFutureCard/);
});

test("Discovery filter modal uses balanced two-column spacing", () => {
  assert.match(client, /label="Renewal timing"/);
  assert.match(client, /label="Opportunity status"/);
  assert.match(client, /styles\.discoveryFilterWideField/);
  assert.match(css, /\.discoveryFilterForm[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.discoveryFilterWideField[\s\S]*grid-column: 1 \/ -1/);
});
