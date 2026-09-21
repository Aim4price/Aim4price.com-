import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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

test('directory returns real accounts and accepted businesses without managed service areas', async () => {
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
  assert.match(partnerAccess, /return \[\.\.\.accounts, \.\.\.outsideBusinesses\]/);
  assert.doesNotMatch(partnerAccess, /listAssistanceDirectoryEntries/);
  assert.match(route, /readBounds/);
  assert.match(route, /west, south, east, north/);
  assert.match(network, /row\.service_key === 'dealer' \? AIM4PRICE_DEALER_ASSISTANCE_PHONE/);
  assert.match(network, /row\.service_key === 'dealer' \? AIM4PRICE_DEALER_ASSISTANCE_EMAIL/);
  assert.match(network, /row\.service_key === 'dealer' \? AIM4PRICE_DEALER_ASSISTANCE_WEBSITE/);
});

test('directory map opens a business profile with a message action and a single help entry', async () => {
  const client = await read('app/asset-register/asset-register-client.tsx');
  const card = await read('components/business-network/BusinessProfileCard.tsx');
  assert.match(client, /<BusinessProfileCard/);
  assert.match(client, /setDirectoryBusiness\(partner\)/);
  assert.match(client, /Need help\?/);
  assert.match(client, /Where are you looking\?/);
  assert.match(client, /openDirectoryExternalShare/);
  assert.match(card, /Send message/);
  assert.match(card, /Aim4price account/);
  assert.doesNotMatch(client, /function buildQuotePartnerPopupHtml/);
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
  assert.match(route, /const leadAssetIds = dealerShareAssetIds\.length && \(\s*assistanceSelection/);
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

test('the one-off Admin controls are removed while database-backed locations remain', async () => {
  const [page, navigation, network] = await Promise.all([
    read('app/admin/assistance-network/page.tsx'),
    read('components/AdminNavigation.tsx'),
    read('lib/assistance-network.ts'),
  ]);
  assert.match(page, /requireAdminPageAccess/);
  assert.match(page, /redirect\('\/admin'\)/);
  assert.doesNotMatch(navigation, /assistance-network|Assistance Network/);
  assert.equal(existsSync(new URL('../app/admin/assistance-network/assistance-network-client.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../app/admin/assistance-network/page.module.css', import.meta.url)), false);
  assert.equal(existsSync(new URL('../app/api/admin/assistance-network/route.ts', import.meta.url)), false);
  assert.match(network, /listAssistanceDirectoryEntries/);
  assert.match(network, /aim4price_assistance_locations/);
});
