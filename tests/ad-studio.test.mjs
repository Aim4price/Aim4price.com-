import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Ad Studio exposes eight reusable one-to-four-photo layouts and safe Brand Kit fields', async () => {
  const source = await read('lib/ad-studio.ts');
  for (const template of [
    'showcase',
    'price-focus',
    'photo-first',
    'classic',
    'minimal',
    'duo-split',
    'gallery-three',
    'catalogue-grid',
  ]) {
    assert.match(source, new RegExp(`id: '${template}'`));
  }
  assert.match(source, /photoCount: 1/);
  assert.match(source, /photoCount: 2/);
  assert.match(source, /photoCount: 3/);
  assert.match(source, /photoCount: 4/);
  assert.match(source, /logoUrl: string/);
  assert.match(source, /primaryColor: string/);
  assert.match(source, /contactName: string/);
  assert.match(source, /vatLabel: AdVatLabel/);
  assert.match(source, /normalizeAdBrandSnapshot/);
});

test('Brand Kits are dealer-only and only dealer owners may edit company kits', async () => {
  const [route, database, capability] = await Promise.all([
    read('app/api/ad-studio/brand-kits/route.ts'),
    read('lib/ad-studio-db.ts'),
    read('lib/dealer-app-access.ts'),
  ]);

  assert.match(route, /profile\.accountType !== 'dealer'/);
  assert.doesNotMatch(route, /profile\.accountType !== 'owner'/);
  assert.match(route, /canManage: !dealerSession \|\| dealerSession\.role === 'owner'/);
  assert.match(route, /Only the Dealer Owner can change company Brand Kits/);
  assert.match(database, /where user_id = \$1/);
  assert.match(database, /pg_advisory_xact_lock/);
  assert.match(capability, /'ad_studio'/);
});

test('schema preserves the selected branding as a Marketplace advert snapshot', async () => {
  const [migration, marketplaceDatabase] = await Promise.all([
    read('database/migrations/73-ad-studio-brand-kits.sql'),
    read('lib/marketplace-db.ts'),
  ]);

  assert.match(migration, /create table if not exists ad_brand_kits/);
  assert.match(migration, /unique index if not exists idx_ad_brand_kits_one_default/);
  assert.match(migration, /marketplace_ad_brand jsonb/);
  assert.match(marketplaceDatabase, /toAdBrandSnapshot\(brandKit\)/);
  assert.match(marketplaceDatabase, /input\.allowBrandKit/);
  assert.match(marketplaceDatabase, /marketplace_ad_brand = \$\$\{updateValues\.length\}::jsonb/);
  assert.match(marketplaceDatabase, /normalizeAdBrandSnapshot\(pick\(row, \['marketplace_ad_brand'\]\)/);
});

test('valuation Create Advert publishes in the background and downloads the matching JPEG', async () => {
  const valuation = await read('app/valuation/valuation-client.tsx');

  assert.match(valuation, /'Create Ad'/);
  assert.match(valuation, /name="brandKitId"/);
  assert.match(valuation, /brandKitId: marketplaceDraft\.brandKitId \|\| null/);
  assert.match(valuation, /createMarketplaceAdJpeg\(listing\)/);
  assert.match(valuation, /downloadMarketplaceAd\(blob, marketplaceAdFilename\(listing\.title\)\)/);
  assert.match(valuation, /The JPEG advert downloaded and the listing is live on Marketplace/);
  assert.doesNotMatch(valuation, /router\.push\(`\$\{marketplacePath\}.*createAd=1/);
  assert.match(valuation, /Owner listings use the standard Aim4price Marketplace advert design/);
  assert.match(valuation, /resolvedAccountType === 'dealer'/);
  assert.match(valuation, /moveMarketplacePhoto/);
  assert.match(valuation, /Main photo/);
  assert.doesNotMatch(valuation, /saveAndSendToMarketplace/);
});

test('Studio and Marketplace use the same rated WYSIWYG JPEG renderer', async () => {
  const [marketplace, studio, renderer] = await Promise.all([
    read('app/marketplace/marketplace-client.tsx'),
    read('components/AdStudioClient.tsx'),
    read('lib/marketplace-ad-renderer.ts'),
  ]);

  assert.match(marketplace, /createSharedMarketplaceAdJpeg\(shareListing\)/);
  assert.match(studio, /renderMarketplaceAdCanvas\(canvas, previewContent/);
  assert.match(studio, /Your downloaded JPEG will match this preview/);
  assert.match(renderer, /id === templateId/);
  assert.match(renderer, /return 'gallery-three'/);
  assert.match(renderer, /return 'duo-split'/);
  assert.match(renderer, /return 'photo-first'/);
  assert.match(renderer, /GREAT PRICE/);
  assert.match(renderer, /FAIR PRICE/);
  assert.match(renderer, /HIGH PRICE/);
  assert.match(renderer, /#22b24b/);
  assert.match(renderer, /#1e9bb3/);
  assert.match(renderer, /Powered by Aim4price\.com/);
  assert.doesNotMatch(renderer, /Created with/);
  assert.doesNotMatch(renderer, /content\.title\.toUpperCase\(\)/);
  assert.match(renderer, /loadImage\(content\.brand\.logoUrl\)/);
  assert.match(renderer, /content\.brand\.email/);
  assert.match(renderer, /content\.brand\.website/);
  assert.match(renderer, /function drawCameraIcon/);
  assert.match(renderer, /function drawPriceCard/);
  assert.match(renderer, /isGenericEquipmentPlaceholder/);
  assert.match(renderer, /naturalTitle\(content\.title\)/);
  assert.match(studio, /imageUrls: \[\]/);
  assert.doesNotMatch(studio, /\/brand\/Tractor\.png/);
  assert.doesNotMatch(marketplace, /JPEG_AD_LOGO_SRC|JPEG_AD_WATERMARK_SRC|CREATED WITH/);
});

test('Ad Studio is limited to dealer accounts and uses a four-step guided setup', async () => {
  const [desktopPage, dealerPage, client, css, header] = await Promise.all([
    read('app/ad-studio/page.tsx'),
    read('app/dealer/ad-studio/page.tsx'),
    read('components/AdStudioClient.tsx'),
    read('components/AdStudioClient.module.css'),
    read('components/AppHeader.tsx'),
  ]);

  assert.match(desktopPage, /profile\.accountType !== 'dealer'/);
  assert.match(desktopPage, /<AdStudioClient/);
  assert.match(dealerPage, /dealerAppMode/);
  assert.match(dealerPage, /middlemanMode=\{isMiddlemanAccountSubtype\(profile\.accountSubtype\)\}/);
  assert.match(client, /Save brand kit/);
  assert.match(client, /type StudioStep = 1 \| 2 \| 3 \| 4/);
  assert.match(client, /Details.*Layout.*Style.*Review/s);
  assert.match(client, /activeStep === 1/);
  assert.match(client, /activeStep === 4/);
  assert.match(client, /Brand kits/);
  assert.match(client, /function StudioIcon/);
  assert.match(client, /Create professional adverts/);
  assert.match(client, /setDefaultKit/);
  assert.match(client, /deleteKit\(kit\)/);
  assert.match(client, /selectedTemplate\.photoCount/);
  assert.doesNotMatch(client, /Saved advert styles|Middleman workspace|styles\.sectionEyebrow/);
  assert.doesNotMatch(client, /step\.helper|Business and contact details.*Choose an advert layout.*Colours and wording.*Check and save/s);
  assert.match(client, /logoPreviewCard/);
  assert.match(client, /A transparent logo works best/);
  assert.match(client, /selectControl/);
  assert.match(client, /StudioIcon name="language"/);
  assert.match(client, /StudioIcon name="price"/);
  assert.match(css, /\.logoPreviewCard/);
  assert.match(css, /\.selectControl select/);
  assert.match(css, /appearance: none/);
  assert.doesNotMatch(css, /\.stepButton small/);
  assert.doesNotMatch(css, /\.stepButton > span:last-child \{ display: none; \}/);
  assert.match(header, /href: '\/ad-studio', label: 'Ad Studio', accountTypes: \['dealer'\]/);
  assert.doesNotMatch(header, /href: '\/ad-studio', label: 'Ad Studio', accountTypes: \['owner'/);
});

test('middlemen have a focused phone-first workspace and a supported account subtype', async () => {
  const [profile, subtype, dealerHome, header, migration, css] = await Promise.all([
    read('lib/account-profile.ts'),
    read('lib/middleman-account.ts'),
    read('app/dealer/page.tsx'),
    read('components/AppHeader.tsx'),
    read('database/migrations/74-middleman-account-subtype.sql'),
    read('app/dealer/dealer.module.css'),
  ]);

  assert.match(subtype, /equipment-middleman/);
  assert.match(profile, /equipment-middleman/);
  assert.match(migration, /equipment-middleman/);
  assert.match(dealerHome, /Middleman workspace/);
  assert.match(dealerHome, /Value it\. Advertise it\. Move it\./);
  assert.match(dealerHome, /middlemanCapabilities/);
  assert.match(header, /MIDDLEMAN_ACCOUNT_MENU_ITEMS/);
  assert.match(header, /My Showroom/);
  assert.doesNotMatch(
    header.match(/const MIDDLEMAN_ACCOUNT_MENU_ITEMS:[\s\S]*?\];/)?.[0] ?? '',
    /Leads|Discovery|My Listings/,
  );
  assert.match(css, /\.middlemanHomeIntro/);
  assert.match(css, /100dvh/);
});

test('signup presents Middleman as a separate free account choice', async () => {
  const [authClient, authPage, profile, accountClient] = await Promise.all([
    read('app/auth/auth-client.tsx'),
    read('app/auth/page.tsx'),
    read('lib/account-profile.ts'),
    read('app/account/account-client.tsx'),
  ]);

  assert.match(authClient, /value: "middleman", label: "Middleman"/);
  assert.match(authClient, /value: "equipment-middleman"/);
  assert.match(authClient, /accountType: signupForm\.accountType === "middleman" \? "dealer"/);
  assert.match(authClient, /name="accountType"[\s\S]*?options=\{SIGNUP_ACCOUNT_TYPE_OPTIONS\}/);
  assert.match(authClient, /name="accountSubtype"[\s\S]*?options=\{SIGNUP_ACCOUNT_SUBTYPE_OPTIONS\[signupForm\.accountType\]\}/);
  assert.match(authClient, /Free workspace for valuation-backed adverts and your public showroom/);
  assert.doesNotMatch(authClient, /accountTypeGrid|role="radiogroup"/);
  assert.match(authClient, /signupForm\.accountType === "middleman" \? "\/my-showroom"/);
  assert.match(authClient, /signupForm\.accountType !== "middleman"/);
  assert.match(authPage, /isMiddlemanAccountSubtype\(profile\.accountSubtype\)[\s\S]*?"\/my-showroom"/);
  assert.match(profile, /isMiddlemanAccountSubtype\(initialAccountSubtype\)[\s\S]*?"active"/);
  assert.match(profile, /!isMiddlemanAccountSubtype\(normalizedAccountSubtype\)/);
  assert.match(accountClient, /isMiddlemanAccountSubtype\(normalizedSubtype\).*return 'Middleman'/);
  assert.match(accountClient, /isPartnerAccount = !isOwnerAccount && !isMiddlemanAccount/);
  assert.match(accountClient, /isDealerAccount && !isMiddlemanAccount/);
});

test('dealer showrooms are standard, valuation-backed and reuse the Marketplace experience', async () => {
  const [showroomDb, publicPage, manager, marketplaceUi, marketplaceDb, dealerHome, header] = await Promise.all([
    read('lib/middleman-showroom-db.ts'),
    read('app/showroom/[slug]/page.tsx'),
    read('components/MiddlemanShowroomClient.tsx'),
    read('app/marketplace/marketplace-client.tsx'),
    read('lib/marketplace-db.ts'),
    read('app/dealer/page.tsx'),
    read('components/AppHeader.tsx'),
  ]);

  assert.match(showroomDb, /middleman_showrooms/);
  assert.match(showroomDb, /function assertDealerProfile/);
  assert.doesNotMatch(showroomDb, /isMiddlemanAccountSubtype/);
  assert.match(publicPage, /sellerUserId: showroom\.userId/);
  assert.match(manager, /Value & create advert/);
  assert.match(manager, /<MarketplaceClient/);
  assert.match(manager, /initialListings=\{listings\}/);
  assert.match(manager, /embeddedMode/);
  assert.match(manager, /showroomMode/);
  assert.match(marketplaceUi, /initialListings\?: MarketplaceListing\[\]/);
  assert.match(marketplaceUi, /if \(showroomMode\)/);
  assert.match(marketplaceUi, /!showroomMode \? \(/);
  assert.match(manager, /Download JPEG/);
  assert.match(manager, /Powered by Aim4price\.com/);
  assert.doesNotMatch(manager, /Created with Aim4price/);
  assert.match(marketplaceDb, /requireValuationSource && !pick\(row, \['valuation_run_id'\]\)/);
  assert.match(dealerHome, /new Set<DealerAppCapability>\(\['valuation', 'ad_studio', 'showroom', 'marketplace'\]\)/);
  assert.match(header, /href: '\/my-showroom', label: 'My Showroom', accountTypes: \['dealer'\]/);
});

test('Middleman navigation, app access and Marketplace stay focused without paid Dealer tools', async () => {
  const [header, dealerHome, dealerMarketplace, account, accessPage, accessClient, leadsPage, discoveryPage] = await Promise.all([
    read('components/AppHeader.tsx'),
    read('app/dealer/page.tsx'),
    read('app/dealer/marketplace/page.tsx'),
    read('app/account/account-client.tsx'),
    read('app/account/dealer-app/page.tsx'),
    read('app/account/app-access-management-client.tsx'),
    read('app/dealer/leads/page.tsx'),
    read('app/dealer/discovery/page.tsx'),
  ]);

  const middlemanHeader = header.match(/if \(isMiddlemanAccountSubtype\(accountSubtype\)\) \{[\s\S]*?\n    \}/)?.[0] ?? '';
  assert.match(middlemanHeader, /Get Estimate/);
  assert.match(middlemanHeader, /Ad Studio/);
  assert.match(middlemanHeader, /My Showroom/);
  assert.match(middlemanHeader, /Marketplace/);
  assert.doesNotMatch(middlemanHeader, /label: 'Account'/);
  assert.doesNotMatch(middlemanHeader, /Leads|Discovery/);
  assert.match(dealerHome, /'showroom', 'marketplace'/);
  assert.doesNotMatch(dealerMarketplace, /isMiddlemanAccountSubtype/);
  assert.match(account, /isMiddlemanAccount \? 'Middleman app access' : 'Manage Dealer App staff'/);
  assert.match(accessPage, /middlemanMode=\{isMiddlemanAccountSubtype\(profile\.accountSubtype\)\}/);
  assert.match(accessClient, /Middleman App Access/);
  assert.match(accessClient, /change passwords or remove a login/);
  assert.match(leadsPage, /isMiddlemanAccountSubtype\(profile\.accountSubtype\).*redirect\('\/dealer\/showroom'\)/s);
  assert.match(discoveryPage, /isMiddlemanAccountSubtype\(profile\.accountSubtype\).*redirect\('\/dealer\/showroom'\)/s);
});

test('deleting a Middleman showroom withdraws all of its Marketplace adverts', async () => {
  const [showroomDb, route, manager, accountDeletion] = await Promise.all([
    read('lib/middleman-showroom-db.ts'),
    read('app/api/middleman-showroom/route.ts'),
    read('components/MiddlemanShowroomClient.tsx'),
    read('lib/account-deletion.ts'),
  ]);

  assert.match(showroomDb, /deleteMiddlemanShowroomAndAdverts/);
  assert.match(showroomDb, /update asset_register_items[\s\S]*marketplace_status = 'draft'/);
  assert.match(showroomDb, /delete from marketplace_listings where user_id = \$1/);
  assert.match(showroomDb, /delete from middleman_showrooms where user_id = \$1/);
  assert.match(showroomDb, /BEGIN[\s\S]*COMMIT/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /deletedAdvertCount/);
  assert.match(manager, /Delete showroom & adverts/);
  assert.match(manager, /Your valuations and saved asset records are not deleted/);
  assert.match(accountDeletion, /'middleman_showrooms'/);
});

test('rating visibility follows the advert through Marketplace, showroom and JPEG export', async () => {
  const [valuation, route, marketplaceDb, marketplaceUi, renderer] = await Promise.all([
    read('app/valuation/valuation-client.tsx'),
    read('app/api/marketplace/route.ts'),
    read('lib/marketplace-db.ts'),
    read('app/marketplace/marketplace-client.tsx'),
    read('lib/marketplace-ad-renderer.ts'),
  ]);

  assert.match(valuation, /Show the Aim4price price rating/);
  assert.match(valuation, /showDealRating: marketplaceDraft\.showDealRating/);
  assert.match(route, /showDealRating: body\.showDealRating !== false/);
  assert.match(marketplaceDb, /marketplace_show_deal_rating/);
  assert.match(marketplaceUi, /listing\.showDealRating === false/);
  assert.match(renderer, /if \(content\.showDealRating === false\) return/);
});

test('Marketplace only applies Brand Kits to dealer listings', async () => {
  const route = await read('app/api/marketplace/route.ts');

  assert.match(route, /brandKitId: accountType === 'dealer'/);
  assert.match(route, /allowBrandKit: accountType === 'dealer'/);
});
