import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

async function loadTypeScriptModule(path) {
  const source = await read(path);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', 'Buffer', output)(module.exports, module, Buffer);
  return module.exports;
}

const AD_TEMPLATE_IDS = [
  'showcase',
  'price-focus',
  'photo-first',
  'classic',
  'minimal',
  'duo-split',
  'gallery-three',
  'catalogue-grid',
];

test('Ad Studio exposes eight reusable one-to-four-photo layouts and safe Brand Kit fields', async () => {
  const source = await read('lib/ad-studio.ts');
  for (const template of AD_TEMPLATE_IDS) {
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

test('schema accepts every supported Ad Studio template', async () => {
  const migration = await read('database/migrations/96-ad-studio-template-options.sql');

  assert.match(migration, /drop constraint if exists ad_brand_kits_template_check/);
  assert.match(migration, /add constraint ad_brand_kits_template_check check/);
  for (const template of AD_TEMPLATE_IDS) {
    assert.match(migration, new RegExp(`'${template}'`));
  }
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

test('valuation advert photos support file drop, drag reorder and accessible order controls', async () => {
  const [valuation, css] = await Promise.all([
    read('app/valuation/valuation-client.tsx'),
    read('app/valuation/page.module.css'),
  ]);

  assert.match(valuation, /const MAX_MARKETPLACE_PHOTOS = 12/);
  assert.match(valuation, /const SUPPORTED_MARKETPLACE_PHOTO_TYPES = new Set\(\['image\/jpeg', 'image\/png', 'image\/webp'\]\)/);
  assert.match(valuation, /const files = inputFiles\.filter\(\(file\) => SUPPORTED_MARKETPLACE_PHOTO_TYPES\.has\(file\.type\)\)/);
  assert.match(valuation, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(valuation, /function handleMarketplacePhotoDrop/);
  assert.match(valuation, /onDrop=\{handleMarketplacePhotoDrop\}/);
  assert.match(valuation, /if \(isPublishingMarketplace\) return;\s*if \(event\.dataTransfer\.files\.length\) addMarketplacePhotos/);
  assert.match(valuation, /function reorderMarketplacePhoto\(sourcePhotoId: string, targetPhotoId: string\)/);
  assert.match(valuation, /setDraggedMarketplacePhotoId\(photo\.id\)/);
  assert.match(valuation, /event\.dataTransfer\.setData\('text\/plain', photo\.id\)/);
  assert.match(valuation, /draggable=\{!isPublishingMarketplace\}/);
  assert.match(valuation, /disabled=\{isPublishingMarketplace\}>\s*Upload photos/);
  assert.match(valuation, /disabled=\{isPublishingMarketplace \|\| index === 0\} aria-label="Move photo earlier"/);
  assert.match(valuation, /disabled=\{isPublishingMarketplace \|\| index === marketplacePhotoFiles\.length - 1\} aria-label="Move photo later"/);
  assert.match(valuation, /disabled=\{isPublishingMarketplace\} aria-label="Remove photo"/);
  assert.match(valuation, /Drag them into order, or use the arrows\. The first photo becomes the main image\./);
  assert.match(valuation, /aria-label="Move photo earlier"/);
  assert.match(valuation, /aria-label="Move photo later"/);
  assert.match(valuation, /for \(const photo of marketplacePhotoFiles\)[\s\S]*?formData\.append\('files', photo\.file\)/);
  assert.match(valuation, /const marketplacePhotoFilesRef = useRef<MarketplacePendingPhoto\[]>\(\[\]\)/);
  assert.match(valuation, /useEffect\(\(\) => \{\s*marketplacePhotoFilesRef\.current = marketplacePhotoFiles;\s*}, \[marketplacePhotoFiles\]\)/);
  assert.match(valuation, /useEffect\(\(\) => \(\) => \{\s*marketplacePhotoFilesRef\.current\.forEach\(\(photo\) => URL\.revokeObjectURL\(photo\.previewUrl\)\);\s*}, \[\]\)/);
  assert.match(css, /\.marketplacePhotoPanelDropActive/);
  assert.match(css, /\.marketplacePhotoThumbDragging/);
});

test('Studio and Marketplace use the same rated WYSIWYG JPEG renderer', async () => {
  const [marketplace, studio, renderer] = await Promise.all([
    read('app/marketplace/marketplace-client.tsx'),
    read('components/AdStudioClient.tsx'),
    read('lib/marketplace-ad-renderer.ts'),
  ]);

  assert.match(marketplace, /createSharedMarketplaceAdJpeg\(shareListing\)/);
  assert.match(studio, /renderMarketplaceAdCanvas\(renderCanvas, previewContent/);
  assert.match(studio, /Your downloaded JPEG will match this preview/);
  assert.match(renderer, /id === templateId/);
  assert.match(renderer, /return 'gallery-three'/);
  assert.match(renderer, /return 'duo-split'/);
  assert.match(renderer, /return 'photo-first'/);
  for (const label of ['Low price', 'Great price', 'Fair price', 'High price', 'No rating']) {
    assert.match(renderer, new RegExp(`label: '${label}'`));
    assert.match(marketplace, new RegExp(`label: '${label}'`));
  }
  assert.doesNotMatch(renderer, /LOW PRICE|GREAT PRICE|FAIR PRICE|HIGH PRICE|NO RATING/);
  assert.match(marketplace, /function formatPlaceholderLabel\(listing: MarketplaceListing\): string \{\s*return getListingFamilyLabel\(listing\);\s*\}/);
  assert.match(renderer, /'BTW ingesluit' : 'VAT included'/);
  assert.match(renderer, /'Geen BTW' : 'No VAT'/);
  assert.match(renderer, /#22b24b/);
  assert.match(renderer, /#1e9bb3/);
  assert.match(renderer, /Powered by Aim4price\.com/);
  assert.doesNotMatch(renderer, /Created with/);
  assert.doesNotMatch(renderer, /content\.title\.toUpperCase\(\)/);
  assert.match(renderer, /loadImage\(content\.brand\.logoUrl\)/);
  assert.match(renderer, /content\.brand\.email/);
  assert.match(renderer, /content\.brand\.website/);
  assert.match(renderer, /function drawCameraIcon/);
  assert.match(renderer, /Main equipment photo/);
  assert.match(renderer, /const maxLogoWidth = Math\.min\(210, rect\.width \* \.36\)/);
  assert.match(renderer, /const plateWidth = Math\.max\(102, logoWidth \+ 28\)/);
  assert.match(renderer, /function equipmentMeta/);
  assert.match(renderer, /function displayPhone/);
  assert.match(renderer, /function drawPriceCard/);
  assert.match(renderer, /isGenericEquipmentPlaceholder/);
  assert.match(renderer, /naturalTitle\(content\.title\)/);
  assert.match(studio, /imageUrls: previewPhotos\.map\(\(photo\) => photo\.previewUrl\)/);
  assert.match(studio, /'BTW ingesluit' : 'VAT included'/);
  assert.match(studio, /'Geen BTW' : 'No VAT'/);
  assert.match(marketplace, /'BTW ingesluit' : 'VAT included'/);
  assert.match(marketplace, /'Geen BTW' : 'No VAT'/);
  assert.doesNotMatch([renderer, studio, marketplace].join('\n'), /VAT INCLUDED|NO VAT|BTW INGESLUIT|GEEN BTW/);
  assert.doesNotMatch(studio, /\/brand\/Tractor\.png/);
  assert.doesNotMatch(marketplace, /JPEG_AD_LOGO_SRC|JPEG_AD_WATERMARK_SRC|CREATED WITH/);
});

test('Ad Studio supports logo drop and local-only sample photo ordering', async () => {
  const [client, css] = await Promise.all([
    read('components/AdStudioClient.tsx'),
    read('components/AdStudioClient.module.css'),
  ]);

  assert.match(client, /type DragEvent/);
  assert.match(client, /const SUPPORTED_PREVIEW_IMAGE_TYPES = new Set\(\['image\/jpeg', 'image\/png', 'image\/webp'\]\)/);
  assert.match(client, /function applyLogoFile/);
  assert.match(client, /if \(!file \|\| !canManage \|\| saving\) return/);
  assert.match(client, /if \(!SUPPORTED_PREVIEW_IMAGE_TYPES\.has\(file\.type\)\)/);
  assert.match(client, /function handleLogoDrop/);
  assert.match(client, /onDrop=\{handleLogoDrop\}/);
  assert.match(client, /role="button"/);
  assert.match(client, /tabIndex=\{canManage && !saving \? 0 : -1\}/);
  assert.match(client, /aria-disabled=\{!canManage \|\| saving\}/);
  assert.match(client, /Choose a file or drop it onto the logo tile/);
  assert.match(client, /const MAX_PREVIEW_PHOTOS = 4/);
  assert.match(client, /const MAX_PREVIEW_PHOTO_BYTES = 10_000_000/);
  assert.match(client, /const imageFiles = files\.filter\(\(file\) => SUPPORTED_PREVIEW_IMAGE_TYPES\.has\(file\.type\)\)/);
  assert.equal(client.match(/accept="image\/png,image\/jpeg,image\/webp"/g)?.length, 2);
  assert.match(client, /function handlePreviewPhotoDrop/);
  assert.match(client, /onDrop=\{handlePreviewPhotoDrop\}/);
  assert.match(client, /function reorderPreviewPhoto/);
  assert.match(client, /function movePreviewPhoto/);
  assert.match(client, /event\.dataTransfer\.setData\('text\/plain', photo\.id\)/);
  assert.match(client, /aria-label="Sample advert photo order"/);
  assert.match(client, /Drop up to four sample photos, then drag them into order\./);
  assert.match(client, /These samples are not saved\./);
  assert.match(client, /They stay in this preview only and are never saved with the brand kit\./);
  assert.match(client, /URL\.revokeObjectURL\(photo\.previewUrl\)/);
  assert.match(client, /body: JSON\.stringify\(draft\)/);
  assert.match(client, /useBestPhotoFit: false/);
  assert.match(client, /let active = true;\s*const renderCanvas = document\.createElement\('canvas'\)/);
  assert.match(client, /renderMarketplaceAdCanvas\(renderCanvas, previewContent,[\s\S]*?\.then\(\(\) => \{\s*if \(!active\) return;[\s\S]*?context\.drawImage\(renderCanvas/);
  assert.match(client, /return \(\) => \{\s*active = false;\s*};/);
  assert.match(css, /\.logoPreviewDragging/);
  assert.match(css, /\.previewPhotoLabActive/);
  assert.match(css, /\.previewPhotoDragging/);
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
  assert.match(css, /font-family: var\(--font-body, "Montserrat"\)/);
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
  assert.match(publicPage, /cache\(getPublicMiddlemanShowroomBySlug\)/);
  assert.equal(publicPage.match(/getCachedPublicShowroom\(slug\)/g)?.length, 2);
  assert.match(manager, /Value and create advert/);
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
  assert.match(dealerHome, /new Set<DealerAppCapability>\(\['inventory', 'valuation', 'ad_studio', 'showroom', 'marketplace'\]\)/);
  assert.match(header, /href: '\/my-showroom', label: 'My Showroom', accountTypes: \['dealer'\]/);
});

test('public showroom scopes friendly Marketplace empty states and removes microcaps', async () => {
  const [manager, managerCss, marketplace, marketplaceCss] = await Promise.all([
    read('components/MiddlemanShowroomClient.tsx'),
    read('components/MiddlemanShowroomClient.module.css'),
    read('app/marketplace/marketplace-client.tsx'),
    read('app/marketplace/page.module.css'),
  ]);

  assert.match(manager, /Professional machinery showroom/);
  assert.match(manager, /Browse available machinery/);
  assert.match(managerCss, /font-family: 'Montserrat'/);
  assert.doesNotMatch(managerCss, /text-transform:\s*uppercase/);
  assert.match(marketplace, /const showroomHasNoInventory = showroomMode && !isLoadingListings && items\.length === 0/);
  assert.match(marketplace, /showroomHasNoInventory \? \(/);
  assert.match(marketplace, /This showroom is getting ready/);
  assert.match(marketplace, /There are no live adverts here just yet\. Please check back soon\./);
  assert.match(marketplace, /Nothing matches those filters/);
  assert.match(marketplace, /showroomMode \? 'Clear filters' : 'Reset marketplace'/);
  assert.match(marketplace, /className=\{`\$\{styles\.page\} \$\{showroomMode \? styles\.showroomPage : ''\}/);
  assert.match(marketplaceCss, /\.showroomPage\s*\{[\s\S]*?font-family: var\(--font-body, 'Montserrat'\)/);
  assert.match(marketplaceCss, /\.showroomPage \*\s*\{[\s\S]*?font-variant-caps:\s*normal/);
  assert.match(marketplaceCss, /\.showroomPage \.placeholderPill,[\s\S]*?text-transform:\s*none/);
  assert.match(marketplaceCss, /\.showroomEmptyShell/);
});

test('showroom manager follows the approved no-bubble layout with consistent link typography', async () => {
  const [manager, managerCss] = await Promise.all([
    read('components/MiddlemanShowroomClient.tsx'),
    read('components/MiddlemanShowroomClient.module.css'),
  ]);

  assert.doesNotMatch(manager, /styles\.eyebrow/);
  assert.doesNotMatch(manager, /styles\.sectionIcon/);
  assert.match(manager, /className=\{styles\.publicLinkField\}/);
  assert.match(manager, /className=\{styles\.copyLinkButton\}/);
  assert.match(manager, /Showroom visible to the public/);
  assert.match(manager, /Save changes/);
  assert.match(manager, /Your showroom is ready/);
  assert.match(manager, /Create your first advert and it will appear here automatically\./);
  assert.doesNotMatch(managerCss, /\.eyebrow\s*\{/);
  assert.doesNotMatch(managerCss, /\.sectionIcon(?:\s|,|\{)/);
  assert.match(managerCss, /\.managerGrid\s*\{[^}]*grid-template-columns:\s*minmax\(360px, \.67fr\) minmax\(0, 1\.08fr\)/);
  assert.match(managerCss, /\.copyLinkButton\s*\{/);
  assert.match(managerCss, /\.slugField\s*\{[^}]*font-family:\s*'Montserrat'/);
  assert.match(managerCss, /\.slugPrefix\s*\{[^}]*font:\s*inherit/);
  assert.match(managerCss, /\.slugField input\s*\{[^}]*font:\s*inherit/);
  assert.doesNotMatch(manager, /emptyStockIllustration|emptyStockMachine/);
  assert.doesNotMatch(managerCss, /\.emptyStockIllustration|\.emptyStockMachine/);
  assert.match(managerCss, /\.emptyStock\s*\{[^}]*align-content:\s*center/);
});

test('showroom logos inherit Ad Studio branding and allow a compact showroom-only override', async () => {
  const [showroomDb, studioDb, validation, route, manager, managerCss, migration] = await Promise.all([
    read('lib/middleman-showroom-db.ts'),
    read('lib/ad-studio-db.ts'),
    read('lib/showroom-logo-validation.ts'),
    read('app/api/middleman-showroom/route.ts'),
    read('components/MiddlemanShowroomClient.tsx'),
    read('components/MiddlemanShowroomClient.module.css'),
    read('database/migrations/97-middleman-showroom-logo.sql'),
  ]);

  assert.match(studioDb, /export async function getAdBrandLogoForUser/);
  assert.match(studioDb, /select logo_url[\s\S]*order by is_default desc, updated_at desc/);
  assert.match(showroomDb, /getAdBrandLogoForUser\(profile\.userId\)/);
  assert.match(showroomDb, /showroomLogoUrl: normalizeAdLogoUrl\(row\.logo_url\)/);
  assert.match(showroomDb, /inheritedLogoUrl: await getAdBrandLogoForUser\(profile\.userId\) \|\| normalizeAdLogoUrl\(profile\.logoUrl\)/);
  assert.match(showroomDb, /const logoUrl = showroomLogoUrl\s*\|\| await getAdBrandLogoForUser/);
  assert.match(showroomDb, /export type PublicMiddlemanShowroomData = MiddlemanShowroomDetails/);
  assert.match(showroomDb, /function mapPublicShowroom/);
  assert.doesNotMatch(showroomDb.match(/export type MiddlemanShowroom =[^;]+;/s)?.[0] ?? '', /logoUrl:/);
  assert.match(showroomDb, /logo_url = \$5/);
  assert.match(showroomDb, /current\.showroomLogoUrl/);
  assert.match(showroomDb, /validateShowroomLogoDataUrl\(requestedLogoUrl\)/);
  assert.match(validation, /function pngDimensions/);
  assert.match(validation, /function jpegDimensions/);
  assert.match(validation, /function webpDimensions/);
  assert.match(validation, /export function validateShowroomLogoDataUrl/);
  assert.match(validation, /bytes\.length > MAX_SHOWROOM_LOGO_BYTES/);
  assert.match(validation, /dimensions\.width > MAX_SHOWROOM_LOGO_DIMENSION/);
  assert.match(validation, /return `data:image\/\$\{mediaType\};base64,\$\{canonicalBase64\}`/);
  assert.match(migration, /add column if not exists logo_url text/);
  assert.match(route, /logoUrl\?: unknown/);
  assert.match(route, /body\.logoUrl === null \? null : undefined/);
  assert.match(route, /isDealerAppSession\(session\) && !dealerRoleCan\(session\.dealerApp\.role, 'showroom'\)/);

  assert.match(manager, /const SHOWROOM_LOGO_TYPES = new Set\(\['image\/jpeg', 'image\/png', 'image\/webp'\]\)/);
  assert.match(manager, /const MAX_SHOWROOM_LOGO_BYTES = 2_000_000/);
  assert.match(manager, /const MAX_SHOWROOM_LOGO_DIMENSION = 4_096/);
  assert.match(manager, /function applyShowroomLogoFile/);
  assert.match(manager, /const image = new Image\(\)/);
  assert.match(manager, /image\.naturalWidth > MAX_SHOWROOM_LOGO_DIMENSION/);
  assert.match(manager, /function handleShowroomLogoDrop/);
  assert.match(manager, /if \(readingLogo\) return/);
  assert.match(manager, /Add a logo to personalise your public showroom\./);
  assert.match(manager, /Using your saved brand logo\. Drop a different logo here if needed\./);
  assert.match(manager, /This custom logo appears only on your public showroom\./);
  assert.match(manager, /PNG, JPEG or WebP · Maximum 2 MB/);
  assert.match(manager, /Use saved brand logo/);
  assert.match(manager, /Remove logo/);
  assert.match(manager, /id="showroom-logo-feedback"/);
  assert.match(manager, /aria-describedby=\{logoFeedback/);
  assert.match(manager, /body: JSON\.stringify\(\{ slug, bio, isPublic, logoUrl: showroomLogoUrl \}\)/);
  assert.match(manager, /showroom\.logoUrl \? <img src=\{showroom\.logoUrl\}/);
  assert.match(managerCss, /\.showroomLogoField\s*\{[^}]*grid-template-columns:\s*4\.25rem minmax\(0,1fr\) auto/);
  assert.match(managerCss, /\.showroomLogoPreview\s*\{[^}]*width:\s*4\.25rem;[^}]*height:\s*3\.5rem/);
  assert.match(managerCss, /\.showroomLogoButton\s*\{[^}]*min-height:\s*2\.65rem/);
  assert.match(managerCss, /\.showroomLogoReset\s*\{[^}]*min-height:\s*2rem/);
  assert.match(managerCss, /@media \(min-width: 1061px\) and \(max-width: 1280px\)[\s\S]*\.showroomLogoActions\s*\{[^}]*grid-column:\s*2/);
  assert.match(managerCss, /\.showroomLogoFeedbackError\s*\{/);
  assert.doesNotMatch(manager, /No brand logo saved yet|>No logo</);
  assert.doesNotMatch(managerCss, /\.showroomLogoPreview\s*\{[^}]*width:\s*100%/);
});

test('showroom logo validation accepts real images and rejects malformed, oversized and oversized-dimension files', async () => {
  const { validateShowroomLogoDataUrl } = await loadTypeScriptModule('lib/showroom-logo-validation.ts');
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGMUiXL7z8DAwMDEAAUAGTYBtxz8IUMAAAAASUVORK5CYII=';
  const jpeg = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDgqKKKo8I//9k=';
  const webp = 'UklGRjAAAABXRUJQVlA4ICQAAABwAQCdASoCAAIAAUAmJaACdAFAAAD+9g/pb/8Wh/bz/g1tKAA=';
  const widePng = 'iVBORw0KGgoAAAANSUhEUgAAEAEAAAABCAYAAACx4wBCAAAALUlEQVR4nO3BMQEAAAQAMDrIJIT+PYjh2ZY1vQEAAAAAAAAAAAAAAAAAAAC8O0lWAbVFnxcHAAAAAElFTkSuQmCC';

  assert.equal(validateShowroomLogoDataUrl(''), '');
  assert.equal(validateShowroomLogoDataUrl(`data:image/png;base64,${png}====`), `data:image/png;base64,${png}`);
  assert.equal(validateShowroomLogoDataUrl(`data:image/jpeg;base64,${jpeg}`), `data:image/jpeg;base64,${jpeg}`);
  assert.equal(validateShowroomLogoDataUrl(`data:image/webp;base64,${webp}`), `data:image/webp;base64,${webp}`);
  assert.throws(() => validateShowroomLogoDataUrl(`data:image/png;base64,${jpeg}`), /valid PNG, JPEG or WebP/);
  assert.throws(() => validateShowroomLogoDataUrl(`data:image/png;base64,${Buffer.from('not an image').toString('base64')}`), /valid PNG, JPEG or WebP/);
  assert.throws(() => validateShowroomLogoDataUrl(`data:image/png;base64,${Buffer.from(png, 'base64').subarray(0, -12).toString('base64')}`), /valid PNG, JPEG or WebP/);
  assert.throws(() => validateShowroomLogoDataUrl(`data:image/png;base64,${Buffer.alloc(2_000_001).toString('base64')}`), /below 2 MB/);
  assert.throws(() => validateShowroomLogoDataUrl(`data:image/png;base64,${widePng}`), /dimensions below 4096/);
});

test('the global footer yields to the dedicated public showroom footer', async () => {
  const [layout, footer] = await Promise.all([
    read('app/layout.tsx'),
    read('components/AppFooter.tsx'),
  ]);

  assert.match(layout, /import AppFooter/);
  assert.match(layout, /<AppFooter \/>/);
  assert.match(footer, /usePathname/);
  assert.match(footer, /pathname\?\.startsWith\('\/showroom\/'\)/);
  assert.match(footer, /return null/);
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
