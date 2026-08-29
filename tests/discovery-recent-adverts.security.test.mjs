import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const store = read("lib/recent-marketplace-adverts.ts");
const sourcingStore = read("lib/marketplace-sourcing-requests.ts");
const migration = read("database/migrations/99-marketplace-sourcing-requests.sql");
const route = read("app/api/asset-discovery/recently-advertised/route.ts");
const client = read("app/asset-discovery/recently-advertised-client.tsx");
const discoveryClient = read("app/asset-discovery/asset-discovery-client.tsx");
const discoveryPage = read("app/asset-discovery/page.tsx");
const requestPage = read("app/marketplace/sourcing-requests/[requestId]/page.tsx");
const css = read("app/asset-discovery/page.module.css");
const marketplaceStore = read("lib/marketplace-db.ts");
const marketplaceRoute = read("app/api/marketplace/route.ts");
const marketplaceClient = read("app/marketplace/marketplace-client.tsx");
const marketplaceWhatsAppAction = read("components/MarketplaceWhatsAppAction.tsx");
const marketplaceWhatsAppStyles = read("components/MarketplaceWhatsAppAction.module.css");
const notifications = read("lib/notifications.ts");
const notificationInbox = read("lib/notification-inbox.ts");
const appHeader = read("components/AppHeader.tsx");
const recentExpanded = client.slice(
  client.indexOf("function renderExpanded("),
  client.indexOf("function renderAdvertCard("),
);
const recentCards = client.slice(
  client.indexOf("function renderAdvertCard("),
  client.indexOf("return (", client.indexOf("function renderAdvertCard(")),
);

const listCte = store.slice(
  store.indexOf("const RECENT_ADVERTS_CTE"),
  store.indexOf("function text"),
);
const listContract = store.slice(
  store.indexOf("export type RecentMarketplaceAdvert ="),
  store.indexOf("export type RecentMarketplaceAdvertOption"),
);
const listFunction = store.slice(
  store.indexOf("export async function listRecentMarketplaceAdverts"),
);
const mapAdvertFunction = store.slice(
  store.indexOf("function mapAdvert"),
  store.indexOf("function option"),
);
const sourcingCreate = sourcingStore.slice(
  sourcingStore.indexOf("export async function createMarketplaceSourcingRequest"),
  sourcingStore.indexOf("export async function listMarketplaceSourcingRequestNotifications"),
);
const sourcingNotifications = sourcingStore.slice(
  sourcingStore.indexOf("export async function listMarketplaceSourcingRequestNotifications"),
  sourcingStore.indexOf("export async function getMarketplaceSourcingRequestForAdvertiser"),
);
const sourcingDetail = sourcingStore.slice(
  sourcingStore.indexOf("export async function getMarketplaceSourcingRequestForAdvertiser"),
);

test("recent advert discovery uses saved history plus a safe legacy-live fallback", () => {
  assert.match(listCte, /from public\.marketplace_listings listing/);
  assert.match(listCte, /union all[\s\S]*from public\.asset_register_items asset/);
  assert.match(listCte, /marketplace_status, 'draft'\) = 'live'/);
  assert.match(listCte, /saved_listing\.status = 'live'/);
  assert.match(listCte, /current_asset\.user_id = listing\.user_id/);
  assert.match(listCte, /row_number\(\) over \([\s\S]*partition by history\.asset_key/);
  assert.match(listCte, /where listing\.advert_rank = 1/);
  assert.match(listFunction, /order by published_at desc, id desc/);
});

test("recent advert list is viewer-scoped, outcome-aware and contact-free", () => {
  assert.match(listCte, /listing\.user_id <> \$1/);
  assert.match(listCte, /advertiser\.account_status = 'active'/);
  assert.match(listCte, /advertiser\.account_type in \('owner', 'dealer'\)/);
  assert.match(listCte, /outcome_reason, ''\) <> 'created_by_mistake'/);
  assert.match(listCte, /outcome_reason in \('sold', 'traded'\) then 'sold'/);
  assert.match(listCte, /listing\.status = 'live' then 'available'/);
  assert.doesNotMatch(listContract, /phone|email/i);
  assert.doesNotMatch(listCte, /seller_phone|seller_email|marketplace_phone|marketplace_email|advertiser\.phone/i);
  assert.doesNotMatch(listCte, /serial|registration|document/i);
  assert.match(
    mapAdvertFunction,
    /description:\s*status === 'available' && sourceAssetId\s*\? text\(row\.description\)\s*: ''/,
  );
});

test("search and pagination are escaped, parameterized and bounded", () => {
  assert.match(store, /const MAX_PAGE_SIZE = 50/);
  assert.match(store, /const MAX_SEARCH_LENGTH = 120/);
  assert.match(store, /function escapeLike/);
  assert.match(listFunction, /ilike '%' \|\| \$2 \|\| '%' escape '\\\\'/);
  assert.match(listFunction, /limit \$6 offset \$7/);
  assert.match(listFunction, /Math\.min\(requestedPage, totalPages\)/);
});

test("the recent-adverts API requires an active permitted account", () => {
  assert.match(route, /status: 'unauthenticated'/);
  assert.match(route, /status: 'forbidden'/);
  assert.match(route, /profile\.accountStatus !== 'active'/);
  assert.match(route, /\['owner', 'dealer'\]\.includes\(profile\.accountType\)/);
  assert.match(route, /dealerRoleCan\(dealerAppSession\.role, 'discovery'\)/);
  assert.match(route, /You must be signed in\.[\s\S]*401/);
  assert.match(route, /active owner and dealer accounts\.[\s\S]*403/);
  assert.match(route, /'Cache-Control': 'private, no-store, max-age=0'/);
  assert.match(route, /Vary: 'Cookie'/);
  assert.match(route, /createMarketplaceSourcingRequest/);
  assert.doesNotMatch(route, /sellerPhone|sellerEmail|getRecentMarketplaceAdvertContact/);
});

test("sourcing requests have dedicated lifecycle, ownership and cleanup constraints", () => {
  assert.match(migration, /create table if not exists public\.marketplace_sourcing_requests/);
  assert.match(migration, /marketplace_listing_id uuid not null[\s\S]*on delete cascade/);
  assert.match(migration, /advertiser_user_id text not null[\s\S]*account_profiles\(user_id\) on delete cascade/);
  assert.match(migration, /requester_user_id text not null[\s\S]*account_profiles\(user_id\) on delete cascade/);
  assert.match(migration, /check \(advertiser_user_id <> requester_user_id\)/);
  assert.match(migration, /status in \('pending', 'viewed', 'declined', 'closed'\)/);
  assert.match(migration, /unique index if not exists idx_marketplace_sourcing_requests_active_once/);
  assert.match(migration, /where status in \('pending', 'viewed'\)/);
});

test("request recipients are resolved server-side from the latest visible advert", () => {
  assert.match(sourcingStore, /const LATEST_VISIBLE_ADVERT_SQL/);
  assert.match(sourcingStore, /union all[\s\S]*from public\.asset_register_items asset/);
  assert.match(sourcingStore, /row_number\(\) over \([\s\S]*partition by history\.asset_key/);
  assert.match(sourcingStore, /advert\.advert_rank = 1/);
  assert.match(sourcingStore, /advert\.marketplace_listing_id = \$2::uuid/);
  assert.match(sourcingStore, /advert\.user_id <> \$1/);
  assert.match(sourcingStore, /requester\.account_status = 'active'/);
  assert.match(sourcingStore, /advertiser\.account_status = 'active'/);
  assert.match(sourcingStore, /outcome_reason, ''\) <> 'created_by_mistake'/);
  assert.doesNotMatch(sourcingCreate, /advertiserUserId:\s*input|input\.advertiser/i);
});

test("request creation is idempotent, bounded and rate-limited", () => {
  assert.match(sourcingStore, /const MAX_MESSAGE_LENGTH = 600/);
  assert.match(sourcingStore, /const MAX_NEW_REQUESTS_PER_HOUR = 20/);
  assert.match(sourcingCreate, /pg_advisory_xact_lock/);
  assert.match(sourcingCreate, /status in \('pending', 'viewed'\)/);
  assert.match(sourcingCreate, /alreadyRequested/);
  assert.match(sourcingCreate, /created_at >= now\(\) - interval '1 hour'/);
  assert.match(sourcingCreate, /MARKETPLACE_SOURCING_RATE_LIMITED/);
  assert.match(sourcingCreate, /MARKETPLACE_SOURCING_REQUESTER_CONTACT_REQUIRED/);
});

test("only the targeted advertiser can open requester-supplied contact", () => {
  assert.doesNotMatch(sourcingNotifications, /requester_contact_phone|requester_contact_email/);
  assert.match(sourcingDetail, /request\.advertiser_user_id = \$1/);
  assert.match(sourcingDetail, /advertiser\.account_status = 'active'/);
  assert.match(sourcingDetail, /for update of request/);
  assert.match(sourcingDetail, /status = 'viewed'/);
  assert.doesNotMatch(sourcingStore, /seller_phone|seller_email|advertiser\.marketplace_phone|advertiser\.marketplace_email/);
  assert.match(requestPage, /request\.requesterPhone/);
  assert.match(requestPage, /request\.requesterEmail/);
  assert.match(requestPage, /advertiserUserId: session\.user\.id/);
});

test("request notifications work for owners and dealers without prefetch side effects", () => {
  assert.match(notifications, /\| 'marketplace_sourcing'/);
  assert.match(notifications, /listMarketplaceSourcingNotifications\(input\.userId\)/);
  assert.match(notifications, /accountType === 'dealer'[\s\S]*listMarketplaceSourcingNotifications/);
  assert.match(notifications, /id: `marketplace-sourcing:\$\{request\.id\}`/);
  assert.match(notifications, /marketplaceSourcingRequestId: request\.id/);
  assert.match(notificationInbox, /item\.marketplaceSourcingRequestId/);
  assert.match(appHeader, /prefetch=\{notification\.marketplaceSourcingRequestId \? false : undefined\}/);
});

test("Discovery preserves existing results and adds a separate recent-adverts view", () => {
  assert.match(discoveryClient, /Available assets/);
  assert.match(discoveryClient, /Recently advertised/);
  assert.match(discoveryClient, /<RecentlyAdvertisedClient compactAppMode=\{compactAppMode\} \/>/);
  assert.match(discoveryClient, /url\.searchParams\.set\("view", "recently-advertised"\)/);
  assert.match(discoveryClient, /activeDiscoveryView !== "discovery"/);
  assert.match(discoveryPage, /searchParams\?\.view/);
  assert.match(discoveryPage, /profile\.accountType !== 'licensing'/);
  assert.doesNotMatch(discoveryClient, /DiscoveryMarketplaceSwitch/);
});

test("cards expose recency and identity while sourcing stays request-based", () => {
  const responseContract = client.slice(
    client.indexOf("type SourcingRequest ="),
    client.indexOf("type IconProps"),
  );
  assert.doesNotMatch(responseContract, /phone|email/i);
  assert.match(client, /timeZone: "Africa\/Johannesburg"/);
  assert.match(client, /by \{advert\.advertiserName\}/);
  assert.match(client, /Sold \/ traded/);
  assert.match(client, /View advert/);
  assert.match(client, /Ask advertiser to source one/);
  assert.match(client, /share your saved Marketplace phone or email only with/);
  assert.match(client, /Request sent/);
  assert.doesNotMatch(client, /WhatsApp advertiser|Call advertiser|Email advertiser/);
});

test("both Discovery views share one toolbar treatment and archived adverts avoid fake branding", () => {
  const toolbarClasses = /assetStyles\.toolbar\} \$\{workspaceStyles\.controlsRow\} \$\{leadStyles\.leadSearchToolbar\} \$\{styles\.parityToolbar/;
  assert.match(discoveryClient, toolbarClasses);
  assert.match(client, toolbarClasses);
  assert.match(client, /leadStyles\.leadRefreshButton/);
  assert.match(client, /styles\.discoveryRefreshButton/);
  assert.match(client, /assetStyles\.filterTriggerButtonActive/);
  assert.match(client, /leadStyles\.leadRefreshIconActive/);
  assert.match(client, /Photo unavailable/);
  assert.doesNotMatch(client, />A4P</);
});

test("recent adverts reuse the normal Discovery card and detail structure", () => {
  for (const token of [
    "assetStyles.assetCard",
    "leadStyles.leadAssetCard",
    "assetStyles.assetCardExpanded",
    "styles.discoveryLeadAssetCard",
    "assetStyles.assetHeader",
    "leadStyles.leadAssetHeader",
    "assetStyles.assetBody",
    "leadStyles.leadAssetBody",
    "styles.discoveryLeadAssetBody",
    "assetStyles.previewWrap",
    "leadStyles.leadPreviewWrap",
    "assetStyles.assetDetailDivider",
    "assetStyles.assetDetailsPanel",
    "styles.discoveryDetailsPanel",
    "assetStyles.assetDetailsGrid",
    "styles.discoveryDetailsGrid",
    "assetStyles.assetPrimaryDetails",
    "styles.discoveryDetailGroup",
    "assetStyles.assetDetailRow",
    "styles.discoveryDetailRow",
    "styles.discoveryAccessNote",
    "styles.discoveryInlineContact",
  ]) {
    assert.ok(recentExpanded.includes(token), `recent adverts should reuse ${token}`);
  }
  assert.doesNotMatch(recentExpanded, /recentAdvertExpandedGrid|recentAdvertDetailGrid/);
});

test("recent advert open and close controls match normal Discovery", () => {
  for (const token of [
    "assetStyles.primaryButton",
    "workspaceStyles.actionButton",
    "workspaceStyles.actionGreen",
    "leadStyles.openLeadButton",
    "styles.discoveryOpenButton",
    "styles.discoveryCloseButton",
  ]) {
    assert.ok(recentCards.includes(token), `recent advert cards should reuse ${token}`);
  }
  assert.match(recentCards, /aria-expanded=\{isExpanded\}/);
  assert.match(recentCards, /aria-controls=\{`recent-advert-\$\{advert\.id\}`\}/);
  assert.match(recentCards, /\{isExpanded \? "Close" : "Open"\}/);
  assert.doesNotMatch(recentCards, /recentAdvertOpenAction|recentAdvertCloseAction|View details|Hide details/);
});

test("WhatsApp contact follows existing authorization boundaries", () => {
  const sellerWhatsAppHelper = marketplaceClient.slice(
    marketplaceClient.indexOf("function cleanPhoneForWhatsApp"),
    marketplaceClient.indexOf("function slugify"),
  );
  const exposedSellerContact = marketplaceClient.slice(
    marketplaceClient.indexOf("{canExposeSellerContact ? ("),
    marketplaceClient.indexOf(") : (", marketplaceClient.indexOf("{canExposeSellerContact ? (")),
  );
  assert.match(client, /View advert &amp; contact seller/);
  assert.match(client, /Their private contact details remain hidden/);
  assert.match(requestPage, /Reply on WhatsApp/);
  assert.match(marketplaceClient, /const activeSellerWhatsAppHref = activeListing && canExposeSellerContact[\s\S]*?sellerWhatsAppHref\(activeListing\)/);
  assert.match(exposedSellerContact, /<MarketplaceWhatsAppAction[\s\S]*?href=\{activeSellerWhatsAppHref\}/);
  assert.doesNotMatch(exposedSellerContact, /styles\.lockedActions/);
  assert.match(sellerWhatsAppHelper, /listing\.sellerPhone/);
  assert.match(sellerWhatsAppHelper, /listing\.publishedBy === 'seed'/);
  assert.match(sellerWhatsAppHelper, /\\d\{7,14\}/);
  assert.match(sellerWhatsAppHelper, /encodeURIComponent\(message\)/);
  assert.doesNotMatch(sellerWhatsAppHelper, /DEFAULT_MARKETPLACE_CONTACT_PHONE/);
  assert.match(marketplaceWhatsAppAction, /WhatsApp seller/);
  assert.match(marketplaceWhatsAppAction, /Open a private chat about this advert/);
  assert.match(marketplaceWhatsAppAction, /target="_blank"/);
  assert.match(marketplaceWhatsAppAction, /rel="noopener noreferrer"/);
  assert.match(marketplaceWhatsAppAction, /referrerPolicy="no-referrer"/);
  assert.match(marketplaceWhatsAppAction, /opens in a new tab/);
  assert.match(marketplaceWhatsAppAction, /aria-hidden="true"/);
  assert.match(marketplaceWhatsAppStyles, /\.action\s*\{[^}]*width:\s*100%;[^}]*min-height:\s*4\.5rem;[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(marketplaceWhatsAppStyles, /\.action:focus-visible\s*\{[^}]*outline:\s*3px solid/);
  assert.match(marketplaceWhatsAppStyles, /@media \(max-width: 480px\)[\s\S]*?\.action\s*\{[^}]*min-height:\s*4\.25rem/);
  assert.match(marketplaceRoute, /profile\.accountStatus !== 'active'/);
  assert.match(marketplaceRoute, /'Cache-Control': 'private, no-store, max-age=0'/);
  assert.match(marketplaceRoute, /Vary: 'Cookie'/);
});

test("new Marketplace snapshots retain discovery details after an asset changes", () => {
  const snapshot = marketplaceStore.slice(
    marketplaceStore.indexOf("async function createMarketplaceListingSnapshot"),
    marketplaceStore.indexOf("function buildMarketplaceListing", marketplaceStore.indexOf("async function createMarketplaceListingSnapshot")),
  );
  assert.match(snapshot, /yearModel: snapshotYear/);
  assert.match(snapshot, /usageAmount: snapshotUsageAmount, usageUnit/);
  assert.match(snapshot, /conditionLabel: snapshotCondition/);
  assert.match(snapshot, /familyLabel: snapshotFamilyLabel/);
});

test("recent adverts and request dialogs remain accessible and responsive", () => {
  assert.match(client, /<h2>\{advert\.title\}<\/h2>/);
  assert.match(client, /<h3>\{advert\.title\}<\/h3>/);
  assert.match(client, /aria-haspopup="dialog"/);
  assert.match(client, /aria-expanded=\{filterOpen\}/);
  assert.match(client, /aria-label=\{`Showing \$\{pagination\.rangeStart\}/);
  assert.match(client, /role="dialog"/);
  assert.match(client, /aria-modal="true"/);
  assert.match(client, /onKeyDown=\{keepFocusInDialog\}/);
  assert.match(client, /aria-busy=\{loading\}/);
  assert.match(client, /aria-live="polite"/);
  assert.match(css, /\.discoveryViewSwitch/);
  assert.match(css, /\.recentAdvertStatus_available/);
  assert.match(css, /\.recentAdvertStatus_sold/);
  assert.match(css, /\.recentAdvertStatus_ended/);
  assert.match(css, /\.compactExpandedTop > a/);
  assert.match(css, /@media \(max-width: 420px\)[\s\S]*\.compactAppSurface \.discoveryDetailsGrid/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.discoveryViewSwitchButtons[\s\S]*grid-template-columns: 1fr/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
