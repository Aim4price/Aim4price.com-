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
const header = read("components/AppHeader.tsx");
const marketplaceClient = read("app/marketplace/marketplace-client.tsx");
const marketplaceEntry = read("app/marketplace/page.tsx");
const ownerAppHome = read("app/owner-app/page.tsx");

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

test("desktop navigation exposes Discovery only through the Marketplace entry page", () => {
  const navigationConfig = header.slice(
    header.indexOf("const BASE_NAV_ITEMS"),
    header.indexOf("function isAccountMenuItemVisible"),
  );

  assert.doesNotMatch(navigationConfig, /href:\s*['"]\/asset-discovery['"]/);
  assert.match(marketplaceEntry, /href="\/asset-discovery"/);
  assert.match(marketplaceEntry, /href="\/marketplace\/browse"/);
});

test("Discovery and Marketplace pages do not render the old switch", () => {
  assert.doesNotMatch(client, /DiscoveryMarketplaceSwitch/);
  assert.doesNotMatch(marketplaceClient, /DiscoveryMarketplaceSwitch/);
});

test("Owner App keeps direct separate Discovery and Marketplace buttons", () => {
  assert.match(ownerAppHome, /href:\s*['"]\/owner-app\/discovery['"]/);
  assert.match(ownerAppHome, /href:\s*['"]\/owner-app\/marketplace['"]/);
});
