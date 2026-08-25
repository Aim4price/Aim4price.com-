import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  hasAdminAssetCoordinates,
} from "../lib/admin-global-assets-shared.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const dataLayer = read("lib/admin-global-assets.ts");
const mapPage = read("app/admin/asset-map/page.tsx");
const mapClient = read("app/admin/asset-map/admin-asset-map-client.tsx");
const discoveryPage = read("app/admin/discovery/page.tsx");
const discoveryClient = read("app/admin/discovery/admin-discovery-client.tsx");
const mapRoute = read("app/api/admin/asset-map/route.ts");
const discoveryRoute = read("app/api/admin/discovery/route.ts");
const customerDiscovery = read("lib/asset-discovery.ts");
const navigation = read("components/AdminNavigation.tsx");

test("Admin global asset pages and APIs enforce Admin access independently", () => {
  assert.match(mapPage, /await requireAdminPageAccess\(\)/);
  assert.match(discoveryPage, /await requireAdminPageAccess\(\)/);
  assert.match(mapRoute, /await requireAdminApiAccess\(\)/);
  assert.match(discoveryRoute, /await requireAdminApiAccess\(\)/);
  assert.match(mapRoute, /if \(!access\.ok\) return access\.response/);
  assert.match(discoveryRoute, /if \(!access\.ok\) return access\.response/);
});

test("the Admin query spans all accounts and reveals owner details only in its own data layer", () => {
  assert.match(dataLayer, /from public\.asset_register_items asset/);
  assert.match(dataLayer, /left join public\.account_profiles profile on profile\.user_id = asset\.user_id/);
  assert.match(dataLayer, /left join public\."user" auth_user on auth_user\.id = asset\.user_id/);
  assert.match(dataLayer, /owner_email/);
  assert.match(dataLayer, /owner_phone/);
  assert.match(dataLayer, /owner_address_line_1/);
  assert.match(dataLayer, /discovery_participation_enabled/);
  assert.doesNotMatch(dataLayer, /profile\.discovery_participation_enabled\s*=\s*true/);
  assert.doesNotMatch(dataLayer, /asset\.user_id\s*<>/);

  assert.match(customerDiscovery, /owner\.discovery_participation_enabled = true/);
  assert.match(customerDiscovery, /asset\.user_id <> \$1/);
});

test("the global map clusters every plottable asset and keeps missing GPS records visible", () => {
  assert.match(mapClient, /leaflet\.markercluster@1\.5\.3/);
  assert.match(mapClient, /markerClusterGroup/);
  assert.match(mapClient, /chunkedLoading: true/);
  assert.match(mapClient, /removeOutsideVisibleBounds: true/);
  assert.match(mapClient, /Missing GPS only/);
  assert.match(mapClient, /No GPS/);
  assert.match(mapClient, /Open owner account/);
  assert.match(mapClient, /Full Discovery record/);
  assert.match(mapClient, /action: "open_account"/);
  assert.match(mapClient, /escapeHtml\(asset\.title\)/);
});

test("Admin Discovery is paginated, filterable and owner contact is already unlocked", () => {
  assert.match(dataLayer, /limit \$\{limitParameter\}/);
  assert.match(dataLayer, /offset \$\{offsetParameter\}/);
  assert.match(dataLayer, /escapeLike\(filters\.search\)/);
  assert.match(discoveryRoute, /searchParams\.get\("pageSize"\)/);
  assert.match(discoveryClient, /Search assets \+ owners/);
  assert.match(discoveryClient, /Discovery disabled · Admin only/);
  assert.match(discoveryClient, /Owner details · Admin unlocked/);
  assert.match(discoveryClient, /mailto:/);
  assert.match(discoveryClient, /tel:/);
  assert.match(discoveryClient, /Open owner account/);
  assert.match(discoveryClient, /View on global map/);
  assert.match(discoveryClient, /role="dialog"/);
  assert.match(discoveryClient, /keepFocusInsideDetails/);
});

test("province options aggregate by the shared normalized province expression", () => {
  assert.match(
    dataLayer,
    /from admin_assets\s+group by nullif\(trim\(owner_province\), ''\)/,
  );
  assert.doesNotMatch(
    dataLayer,
    /group by coalesce\(nullif\(trim\(owner_province\), ''\), '__not_saved__'\)/,
  );
});

test("the Admin Manage menu exposes the two global asset workspaces", () => {
  assert.match(navigation, /href: "\/admin\/asset-map"/);
  assert.match(navigation, /label: "Global Asset Map"/);
  assert.match(navigation, /href: "\/admin\/discovery"/);
  assert.match(navigation, /label: "Admin Discovery"/);
  assert.match(navigation, /Search all assets with owner details unlocked/);
});

test("coordinate validation accepts real points and rejects missing or placeholder points", () => {
  assert.equal(hasAdminAssetCoordinates({ lastKnownLat: -29.1, lastKnownLng: 24.4 }), true);
  assert.equal(hasAdminAssetCoordinates({ lastKnownLat: null, lastKnownLng: 24.4 }), false);
  assert.equal(hasAdminAssetCoordinates({ lastKnownLat: 0, lastKnownLng: 0 }), false);
  assert.equal(hasAdminAssetCoordinates({ lastKnownLat: 91, lastKnownLng: 24.4 }), false);
});
