import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const expectedProvinceCounts = {
  Gauteng: 7,
  'Western Cape': 15,
  'Eastern Cape': 12,
  'Northern Cape': 10,
  'Free State': 14,
  'KwaZulu-Natal': 12,
  Mpumalanga: 10,
  Limpopo: 10,
  'North West': 10,
};

test('location seed contains the 100 requested unique South African service areas', async () => {
  const seed = JSON.parse(await read('database/seeds/aim4price-assistance-locations.json'));
  assert.equal(seed.length, 100);
  assert.equal(new Set(seed.map((entry) => entry.slug)).size, 100);
  assert.deepEqual(
    Object.fromEntries(Object.keys(expectedProvinceCounts).map((province) => [
      province,
      seed.filter((entry) => entry.province === province).length,
    ])),
    expectedProvinceCounts,
  );

  const towns = new Set(seed.map((entry) => entry.town));
  for (const town of [
    'Johannesburg', 'Pretoria', 'Cape Town', 'Beaufort West', 'Gqeberha',
    'Graaff-Reinet', 'Kimberley', 'Springbok', 'Bloemfontein', 'Sasolburg',
    'Durban', 'Pongola', 'Mbombela', 'eMkhondo', 'Polokwane', 'Groblersdal',
    'Rustenburg', 'Schweizer-Reneke', 'Wolmaransstad', 'Zeerust',
  ]) {
    assert.ok(towns.has(town), `${town} is missing`);
  }

  for (const location of seed) {
    assert.ok(location.latitude >= -35 && location.latitude <= -22, `${location.town} latitude`);
    assert.ok(location.longitude >= 16 && location.longitude <= 33, `${location.town} longitude`);
    assert.ok(location.serviceRadiusKm >= 75 && location.serviceRadiusKm <= 200, `${location.town} radius`);
    assert.match(location.geonamesId, /^\d+$/);
  }
  assert.equal(seed.find((entry) => entry.town === 'Beaufort West').serviceRadiusKm, 180);
  assert.ok(seed.filter((entry) => entry.province === 'Northern Cape').every((entry) => entry.serviceRadiusKm >= 120));
});

test('exactly five login-capable master accounts route through the required Aim4price addresses', async () => {
  const [network, migration] = await Promise.all([
    read('lib/assistance-network.ts'),
    read('database/migrations/77-national-assistance-network.sql'),
  ]);
  const aliases = [
    'finance@aim4price.com',
    'accounting@aim4price.com',
    'insurance@aim4price.com',
    'dealers@aim4price.com',
    'licensing@aim4price.com',
  ];
  for (const alias of aliases) {
    assert.match(network, new RegExp(alias.replace('.', '\\.')));
    assert.match(migration, new RegExp(alias.replace('.', '\\.')));
  }
  assert.equal((network.match(/serviceKey: '/g) ?? []).length, 5);
  assert.match(network, /AIM4PRICE_ASSISTANCE_ROUTING_EMAIL = 'aim4price@gmail\.com'/);
  assert.match(network, /AIM4PRICE_DEALER_ASSISTANCE_EMAIL = 'aim4price@gmail\.com'/);
  assert.match(network, /AIM4PRICE_DEALER_ASSISTANCE_PHONE = '062 572 1650'/);
  assert.match(network, /AIM4PRICE_DEALER_ASSISTANCE_WEBSITE = 'https:\/\/www\.aim4price\.com'/);
  assert.match(network, /managed_by_user_id/);
  assert.match(network, /partner_directory_enabled = false/);
  assert.match(network, /Aim4price-managed assistance login/);
  assert.doesNotMatch(network, /insert into\s+(public\.)?"?user"?/i);
  assert.match(migration, /INSERT INTO\s+public\."user"/i);
  assert.match(migration, /INSERT INTO\s+public\."account"/i);
  assert.match(migration, /"providerId"\s*=\s*'credential'/i);
  assert.match(migration, /Existing non-empty credential passwords are never overwritten/);
});

test('seed and schema are idempotent, duplicate-safe and preserve admin visibility choices', async () => {
  const [network, migration] = await Promise.all([
    read('lib/assistance-network.ts'),
    read('database/migrations/77-national-assistance-network.sql'),
  ]);
  for (const source of [network, migration]) {
    assert.match(source, /unique \(service_key, town_slug\)/i);
    assert.match(source, /on conflict \(service_key, town_slug\) do update/i);
    assert.match(source, /on conflict \(service_key\) do update/i);
    assert.doesNotMatch(source, /\b(delete from|truncate)\s+(account_profiles|aim4price_assistance)/i);
  }
  const accountUpsert = migration.match(/ON CONFLICT \(service_key\) DO UPDATE SET([\s\S]*?)WITH master_seed/)?.[1] ?? '';
  const locationUpsert = migration.match(/ON CONFLICT \(service_key, town_slug\) DO UPDATE SET([\s\S]*?)COMMIT/)?.[1] ?? '';
  assert.doesNotMatch(accountUpsert, /enabled\s*=/i);
  assert.doesNotMatch(locationUpsert, /enabled\s*=/i);
  assert.match(network, /jsonb_to_recordset/);
  assert.match(network, /pg_advisory_xact_lock/);
});

test('directory keeps real partners first and loads managed listings by viewport or search', async () => {
  const [network, partnerAccess, route] = await Promise.all([
    read('lib/assistance-network.ts'),
    read('lib/partner-access.ts'),
    read('app/api/partners/route.ts'),
  ]);
  assert.match(network, /This location represents an Aim4price service area, not a physical branch/);
  assert.match(network, /displayName: `\$\{row\.listing_prefix\} – \$\{row\.town\}`/);
  assert.match(network, /l\.latitude between/);
  assert.match(network, /l\.longitude between/);
  assert.match(network, /filters\.push\('false'\)/);
  assert.match(partnerAccess, /activeDifference/);
  assert.match(partnerAccess, /distanceKm/);
  assert.match(partnerAccess, /return \[\.\.\.genuinePartners, \.\.\.assistancePartners\]/);
  assert.match(route, /readBounds/);
  assert.match(route, /west, south, east, north/);
  assert.match(network, /row\.service_key === 'dealer' \? AIM4PRICE_DEALER_ASSISTANCE_PHONE/);
  assert.match(network, /row\.service_key === 'dealer' \? AIM4PRICE_DEALER_ASSISTANCE_EMAIL/);
  assert.match(network, /row\.service_key === 'dealer' \? AIM4PRICE_DEALER_ASSISTANCE_WEBSITE/);
});

test('desktop and mobile maps ask for an area, cluster markers and refresh on map movement', async () => {
  const [client, css] = await Promise.all([
    read('app/asset-register/asset-register-client.tsx'),
    read('app/asset-register/page.module.css'),
  ]);
  assert.match(client, /leaflet\.markercluster@1\.5\.3/);
  assert.match(client, /markerClusterGroup/);
  assert.match(client, /chunkedLoading: true/);
  assert.match(client, /removeOutsideVisibleBounds: true/);
  assert.match(client, /\.on\('moveend', handleViewportChange\)/);
  assert.match(client, /quoteViewportTimeoutRef/);
  assert.match(client, /type QuoteDirectoryStage = 'location' \| 'map'/);
  assert.match(client, /Where do you need help\?/);
  assert.match(client, /resolveQuoteLocationMapTarget/);
  assert.match(client, /QUOTE_LOCATION_SUGGESTIONS/);
  assert.match(client, /Use current location/);
  assert.match(client, /quoteInitialMapLocationRef/);
  assert.match(client, /autoPan: false/);
  assert.match(client, /isQuoteMapExpanded/);
  assert.match(client, /Click the map to expand/);
  assert.match(client, /Expand partner map/);
  assert.match(client, /invalidateSize\(\{ animate: false, pan: false \}\)/);
  assert.doesNotMatch(client, /focusQuotePartnerOnMap/);
  assert.doesNotMatch(client, /const selectedMarker = selectedQuotePartnerIds/);
  assert.match(client, /params\.set\('west'/);
  assert.match(client, /Aim4price service area/);
  assert.match(client, /service area, not a physical branch/i);
  assert.match(client, /function openDealerAssistanceMessage/);
  assert.match(client, /data-quote-partner-action="\$\{opensMessage \? 'message' : 'toggle'\}"/);
  assert.match(client, /Message Aim4price/);
  assert.match(client, /setQuoteLeadStep\('message'\)/);
  assert.match(client, /quotePartnerWebsiteDisplay/);
  assert.match(css, /\.marker-cluster-small/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /assetQuoteMapEmptyOverlay/);
  assert.match(css, /assetQuoteLocationPickerModal/);
  assert.match(css, /assetQuoteChangeLocationButton/);
  assert.match(css, /\.optionsModal\.assetQuoteModal\.assetQuoteLocationPickerModal/);
  assert.match(css, /assetQuoteMapExpandButton/);
  assert.match(css, /assetQuoteMapExpandedModal/);
  assert.match(css, /assetQuotePartnerAction/);
  assert.match(css, /assetQuoteSelectedCompanyHero/);
  assert.match(css, /assetQuoteManagedKicker/);
});

test('managed selection shares all selected assets with the master and records grouped context', async () => {
  const [client, ownerAppClient, route, network] = await Promise.all([
    read('app/asset-register/asset-register-client.tsx'),
    read('app/owner-app/assets/[assetId]/owner-asset-options-client.tsx'),
    read('app/api/asset-leads/route.ts'),
    read('lib/assistance-network.ts'),
  ]);
  assert.match(client, /partnerUserId: partner\.masterAccountUserId \|\| partner\.userId/);
  assert.match(client, /assistanceLocationId: partner\.assistanceLocationId/);
  assert.match(client, /activeShareAssets\.map\(\(asset\) => asset\.id\)/);
  assert.match(client, /assetGroupId: assetGroupShareTarget\?\.id/);
  assert.match(client, /assetGroupName: assetGroupShareTarget\?\.name/);
  assert.match(ownerAppClient, /partnerUserId: selectedPartner\.masterAccountUserId \|\| selectedPartner\.userId/);
  assert.match(ownerAppClient, /assistanceLocationId: selectedPartner\.assistanceLocationId/);
  assert.match(ownerAppClient, /No external provider will receive your asset without your further approval/);
  assert.match(ownerAppClient, /www\.aim4price\.com/);
  assert.match(route, /resolveAssistanceSelection/);
  assert.match(route, /assistanceSelection && dealerShareAssetIds\.length/);
  assert.match(route, /createAssistanceRequest/);
  assert.match(network, /selected_asset_ids_json/);
  assert.match(network, /asset_lead_ids_json/);
  assert.equal((network.match(/\) returning id::text/g) ?? []).length, 1);
  assert.match(network, /asset_group_id/);
  assert.match(network, /owner_user_id/);
  assert.match(network, /province, town/);
});

test('notification routing and external-provider approval guard are explicit', async () => {
  const [network, migration, client] = await Promise.all([
    read('lib/assistance-network.ts'),
    read('database/migrations/77-national-assistance-network.sql'),
    read('app/asset-register/asset-register-client.tsx'),
  ]);
  assert.match(network, /to: input\.selection\.notificationEmail/);
  assert.match(network, /replyTo: input\.selection\.routingEmail/);
  assert.match(network, /Do not share these assets with an external provider until the owner gives further approval/);
  assert.match(network, /externalProviderShared: false/);
  assert.match(network, /assertAssistanceProviderShareApproved/);
  assert.match(network, /provider_approved_by_user_id = owner_user_id/);
  assert.match(migration, /aim4price_assistance_requests_external_share_check/);
  assert.match(migration, /external_provider_user_id IS NULL/);
  assert.match(client, /will not be shared with an external provider without your further approval/i);
});

test('administrators can disable a whole service or individual location', async () => {
  const [api, page, client, css] = await Promise.all([
    read('app/api/admin/assistance-network/route.ts'),
    read('app/admin/assistance-network/page.tsx'),
    read('app/admin/assistance-network/assistance-network-client.tsx'),
    read('app/admin/assistance-network/page.module.css'),
  ]);
  assert.match(api, /isAim4priceAdminEmail/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /setAssistanceEnabled/);
  assert.match(page, /requireAdminPageAccess/);
  assert.match(client, /locationId: location\.id/);
  assert.match(client, /Service on/);
  assert.match(client, /Visible/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
