import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("database/migrations/94-asset-discovery-view-tracking.sql");
const viewStore = read("lib/discovery-views.ts");
const discoveryDetailsRoute = read(
  "app/api/asset-discovery/assets/[assetId]/details/route.ts",
);
const adminData = read("lib/admin-global-assets.ts");
const adminApi = read("app/api/admin/discovery/route.ts");
const adminClient = read("app/admin/discovery/admin-discovery-client.tsx");

test("Discovery records only successful protected opens and excludes false demand", () => {
  assert.match(migration, /create table if not exists public\.asset_discovery_views/);
  assert.match(migration, /num_nonnulls\(viewer_user_id, anonymous_viewer_hash\) = 1/);
  assert.match(migration, /idx_asset_discovery_views_account_repeat/);
  assert.match(migration, /unique index if not exists idx_asset_discovery_views_account_window/);
  assert.doesNotMatch(migration, /\bip_address\s+(?:text|inet)/i);
  assert.doesNotMatch(migration, /\buser_agent\s+text/i);

  assert.match(viewStore, /DUPLICATE_WINDOW_SECONDS = 45/);
  assert.match(viewStore, /\$3::text <> asset\.user_id/);
  assert.match(viewStore, /owner\.discovery_participation_enabled, false\) = true/);
  assert.match(viewStore, /in \('active', 'transfer_pending'\)/);
  assert.match(viewStore, /on conflict do nothing/);
  assert.match(viewStore, /isDatabaseSchemaReady/);

  const detailsPosition = discoveryDetailsRoute.indexOf(
    "const details = await getAssetDiscoveryAssetDetails",
  );
  const recordPosition = discoveryDetailsRoute.indexOf(
    "await recordAssetDiscoveryView",
  );
  assert.ok(detailsPosition >= 0 && recordPosition > detailsPosition);
  assert.match(discoveryDetailsRoute, /randomUUID\(\)/);
  assert.match(discoveryDetailsRoute, /isAim4priceAdminEmail\(session\.user\.email\)/);
  assert.match(discoveryDetailsRoute, /isAdminSupportSession\(session\)/);
});

test("Discovery viewer identities and exact timestamps remain Admin-only", () => {
  assert.match(adminApi, /await requireAdminApiAccess\(\)/);
  assert.match(adminApi, /viewAssetId/);
  assert.match(adminApi, /getAdminDiscoveryViewDetails/);
  assert.match(adminApi, /Cache-Control": "private, no-store"/);
  assert.match(viewStore, /Unknown viewer \$\{alias\}/);
  assert.match(viewStore, /hasRepeatInterest: viewCount >= 3/);
  assert.match(adminClient, /Viewer summary — \{activityTarget\.title\}/);
  assert.doesNotMatch(adminClient, /Who viewed \{activityTarget\.title\}, and when\?/);
  assert.match(adminClient, /Aim4price .* account viewed this asset/);
  assert.match(adminClient, /Unknown viewer viewed this asset/);
  assert.match(adminClient, /formatDateTime\(viewEvent\.viewedAtIso\)/);
});

test("Admin Discovery can isolate popular, repeat and unviewed assets", () => {
  assert.match(adminData, /if \(filters\.interest === "viewed"\)/);
  assert.match(adminData, /where\.push\("total_views > 0"\)/);
  assert.match(adminData, /where\.push\("has_repeat_interest = true"\)/);
  assert.match(adminData, /where\.push\("total_views = 0"\)/);
  assert.match(adminData, /sort === "popular"/);
  assert.match(adminData, /sort === "repeat-interest"/);
  assert.match(adminData, /sort === "recent-view"/);
  assert.match(adminData, /bool_or\(view_count >= 3\)/);
  assert.match(adminClient, /aria-label="Discovery popularity filter"/);
  assert.match(adminClient, />Most viewed</);
  assert.match(adminClient, />Strongest repeat interest</);
  assert.match(adminClient, />Most recently viewed</);
});

test("the viewer summary is lazy, grouped and keyboard-accessible", () => {
  const openPosition = adminClient.indexOf("function openActivityModal");
  const fetchPosition = adminClient.indexOf(
    "fetch(`/api/admin/discovery?${params.toString()}`",
  );
  assert.ok(openPosition >= 0 && fetchPosition >= 0);
  assert.match(adminClient, /Viewer summary/);
  assert.doesNotMatch(adminClient, /Grouped by Aim4price account or unknown viewer/);
  assert.match(adminClient, /role="dialog"/);
  assert.match(adminClient, /keepFocusInsideActivity/);
  assert.match(adminClient, /activityDetails\.viewerGroups\.map/);
  assert.match(adminClient, /activityDetails\.events\.map/);
  assert.match(adminClient, /Load older views/);
});

test("Discovery summary aggregation is set-based instead of one query per asset", () => {
  assert.match(adminData, /discovery_viewer_counts as/);
  assert.match(adminData, /discovery_view_metrics as/);
  assert.match(adminData, /coalesce\(sum\(total_views\), 0\)::bigint as total_views/);
  assert.match(adminData, /count\(\*\) filter \(where has_repeat_interest\)/);
  assert.doesNotMatch(adminData, /for \(const asset[\s\S]{0,300}getDb\(\)\.query/);
});
