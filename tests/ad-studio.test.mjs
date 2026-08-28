import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

async function loadTypeScriptModule(path, dependencies = {}) {
  const source = await read(path);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const loadDependency = (specifier) => {
    if (Object.prototype.hasOwnProperty.call(dependencies, specifier)) return dependencies[specifier];
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };
  new Function('exports', 'module', 'Buffer', 'require', output)(module.exports, module, Buffer, loadDependency);
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
  assert.match(studio, /(?:downloaded JPEG[^<}`]*match(?:es)? this preview|downloaded advert will look)/i);
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
  assert.match(client, /aria-label=\{draft\.logoUrl \?/);
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
  assert.match(client, /(?:Add|Drop) up to four (?:sample )?photos[^<}`]*(?:drag|reorder)/i);
  assert.match(client, /(?:not saved|preview only|never saved)/i);
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
  assert.match(client, /Save (?:brand kit|advert style)/);
  assert.match(client, /type StudioStep = 1 \| 2 \| 3 \| 4/);
  assert.match(client, /Details.*Layout.*Style.*Review/s);
  assert.match(client, /activeStep === 1/);
  assert.match(client, /activeStep === 4/);
  assert.match(client, /(?:Brand kits|advert styles)/i);
  assert.match(client, /Create (?:professional )?adverts(?: that look like your business)?/i);
  assert.match(client, /setDefaultKit/);
  assert.match(client, /deleteKit\(kit\)/);
  assert.match(client, /selectedTemplate\.photoCount/);
  assert.doesNotMatch(client, /Middleman workspace|styles\.sectionEyebrow/);
  assert.doesNotMatch(client, /step\.helper/);
  assert.match(client, /logoInputRef\.current\?\.click\(\)/);
  assert.match(client, /aria-label=\{draft\.logoUrl \?/);
  assert.match(client, /selectControl/);
  assert.match(client, /<select value=\{draft\.language\}/);
  assert.match(client, /<select value=\{draft\.vatLabel\}/);
  assert.match(css, /\.logo(?:PreviewCard|Field|DropZone)/);
  assert.match(css, /\.selectControl select/);
  assert.match(css, /appearance: none/);
  assert.match(css, /font-family:[^;\n]*Montserrat/);
  assert.doesNotMatch(css, /\.stepButton small/);
  assert.doesNotMatch(css, /\.stepButton > span:last-child \{ display: none; \}/);
  assert.match(header, /href: '\/ad-studio', label: 'Ad Studio', accountTypes: \['dealer'\]/);
  assert.doesNotMatch(header, /href: '\/ad-studio', label: 'Ad Studio', accountTypes: \['owner'/);
});

test('Ad Studio follows the white, minimal Showroom visual system', async () => {
  const [client, css] = await Promise.all([
    read('components/AdStudioClient.tsx'),
    read('components/AdStudioClient.module.css'),
  ]);

  const block = (selector) => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  };
  const minimumHeight = (declarations) => Number(declarations.match(/min-height:\s*([\d.]+)px/)?.[1] ?? 0);

  const heroRule = block('.hero');
  const cardRule = css.match(/\.libraryPanel\s*,\s*\.formPanel\s*,\s*\.previewPanel\s*\{([^}]*)\}/)?.[1] ?? '';
  const sharedControlRule = css.match(/\.primaryButton\s*,[\s\S]*?\.logoRemove\s*\{([^}]*)\}/)?.[1] ?? '';
  const primaryButtonRule = block('.primaryButton');
  const stepperRule = block('.stepper');
  const stepButtonRule = block('.stepButton');
  const activeStepRule = block('.stepButtonActive');
  const workspaceRule = block('.workspace');
  const heroMarkup = client.match(/<header className=\{styles\.hero\}>[\s\S]*?<\/header>/)?.[0] ?? '';

  assert.match(heroRule, /background:\s*#fff(?:fff)?\b/i);
  assert.match(heroRule, /border:\s*1px solid var\(--studio-line\)/);
  assert.doesNotMatch(heroRule, /(?:linear|radial)-gradient|#102a23|#15392f|#17385d/i);
  assert.match(cardRule, /background:\s*#fff(?:fff)?\b/i);
  assert.match(cardRule, /border:\s*1px solid var\(--studio-line\)/);

  assert.match(block('.page'), /font-family:[^;]*Montserrat/i);
  assert.match(css, /\.page button\s*,[\s\S]*?font-family:\s*inherit/);
  assert.doesNotMatch(css, /text-transform:\s*uppercase/i);

  assert.doesNotMatch(client, /styles\.(?:heroMetric|heroMetricIcon|previewIcon|previewPills|previewPill)\b/);
  assert.doesNotMatch(client, /(?:Details|Layout|Style|Review)\s*·\s*Step [1-4] of 4/);
  assert.doesNotMatch(heroMarkup, /(?:Ready|Brand kits? saved|Create your first brand kit)/i);

  assert.ok(minimumHeight(sharedControlRule) >= 44, 'Primary and secondary actions must remain at least 44px high');
  assert.ok(minimumHeight(stepButtonRule) >= 44, 'Each setup step must remain at least 44px high');
  assert.match(primaryButtonRule, /background:\s*var\(--studio-green\)/);
  assert.doesNotMatch(primaryButtonRule, /gradient/i);

  assert.match(stepperRule, /background:\s*#fff(?:fff)?\b/i);
  assert.match(stepButtonRule, /border-bottom:\s*[\d.]+px solid transparent/);
  assert.match(activeStepRule, /border-bottom-color:\s*var\(--studio-green\)/);
  assert.doesNotMatch(activeStepRule, /gradient/i);
  assert.match(client, /aria-current=\{activeStep === step\.id \? 'step' : undefined\}/);

  assert.match(workspaceRule, /grid-template-columns:[^;]*minmax\([^;]*minmax\(/);
  assert.match(css, /@media\s*\(max-width:\s*[\d.]+px\)[\s\S]*?\.workspace\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /@media\s*\(max-width:\s*[\d.]+px\)[\s\S]*?\.previewPanel\s*\{[^}]*grid-row:\s*auto/);
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

test('owner and dealer showrooms reuse the seller-scoped Marketplace experience', async () => {
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
  assert.match(showroomDb, /function isShowroomProfile/);
  assert.match(showroomDb, /profile\.accountType === 'owner' \|\| profile\.accountType === 'dealer'/);
  assert.match(showroomDb, /profile\.accountStatus === 'active'/);
  assert.match(showroomDb, /function assertShowroomProfile/);
  assert.match(showroomDb, /throw new Error\('SHOWROOM_FORBIDDEN'\)/);
  assert.match(showroomDb, /if \(!isShowroomProfile\(profile\)\) return null/);
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
  assert.match(manager, /Hosted on Aim4price\.com/);
  assert.doesNotMatch(manager, /Created with Aim4price/);
  assert.match(marketplaceDb, /requireValuationSource && !pick\(row, \['valuation_run_id'\]\)/);
  assert.match(dealerHome, /new Set<DealerAppCapability>\(\['inventory', 'valuation', 'ad_studio', 'showroom', 'marketplace'\]\)/);
  assert.match(header, /href: '\/my-showroom', label: 'My Showroom', accountTypes: \['dealer'\]/);
});

test('owners manage a private-by-default showroom from Account without owner navigation shortcuts', async () => {
  const [showroomDb, myShowroomPage, route, accountClient, accountCss, header, publicPage, marketplaceDb] = await Promise.all([
    read('lib/middleman-showroom-db.ts'),
    read('app/my-showroom/page.tsx'),
    read('app/api/middleman-showroom/route.ts'),
    read('app/account/account-client.tsx'),
    read('app/account/page.module.css'),
    read('components/AppHeader.tsx'),
    read('app/showroom/[slug]/page.tsx'),
    read('lib/marketplace-db.ts'),
  ]);

  const ownerNav = header.match(/const OWNER_NAV_ITEMS: NavItem\[\] = \[[\s\S]*?\n\];/)?.[0] ?? '';

  assert.match(accountClient, /const isOwnerAccount = normalizedAccountType === "owner"/);
  assert.match(accountClient, /\{isOwnerAccount \? \([\s\S]*?<Link href="\/my-showroom" className=\{styles\.quickActionButton\}>[\s\S]*?<strong>Manage my showroom<\/strong>/);
  assert.match(accountClient, /QuickActionIcon name="showroom"/);
  assert.match(accountCss, /\.quickActionButton:focus-visible\s*\{/);
  assert.doesNotMatch(ownerNav, /showroom|my-showroom/i);
  assert.match(header, /href: '\/my-showroom', label: 'My Showroom', accountTypes: \['dealer'\]/);

  assert.match(myShowroomPage, /getServerSession\(\{ allowDealerApp: true \}\)/);
  assert.doesNotMatch(myShowroomPage, /allowOwnerApp/);
  assert.match(myShowroomPage, /active=\{profile\.accountType === 'owner' \? 'account' : 'showroom'\}/);
  assert.match(myShowroomPage, /viewerUserId: session\.user\.id/);
  assert.match(myShowroomPage, /sellerUserId: session\.user\.id/);
  assert.match(myShowroomPage, /exposeContact: true/);

  assert.match(route, /getServerSession\(\{ allowDealerApp: true \}\)/);
  assert.doesNotMatch(route, /allowOwnerApp/);
  assert.match(route, /isDealerAppSession\(session\) && !dealerRoleCan\(session\.dealerApp\.role, 'showroom'\)/);
  assert.equal(route.match(/message === 'SHOWROOM_FORBIDDEN' \? 403/g)?.length, 3);
  assert.match(route, /if \(!context\) return NextResponse\.json\(\{ ok: false, error: 'You must be signed in\.' \}, \{ status: 401 \}\)/);
  assert.match(route, /viewerUserId: context\.session\.user\.id/);
  assert.match(route, /sellerUserId: context\.session\.user\.id/);
  assert.match(route, /exposeContact: true/);

  assert.match(showroomDb, /insert into middleman_showrooms \(user_id, slug, is_public\)/);
  assert.match(showroomDb, /\[profile\.userId, slug, profile\.accountType !== 'owner'\]/);
  assert.match(showroomDb, /const ownerContactOnly = profile\.accountType === 'owner'/);
  assert.match(showroomDb, /phone: profile\.marketplacePhone \|\| \(ownerContactOnly \? '' : profile\.phone\)/);
  assert.match(showroomDb, /email: profile\.marketplaceEmail \|\| \(ownerContactOnly \? '' : profile\.email\)/);
  assert.match(publicPage, /sellerUserId: showroom\.userId/);
  assert.doesNotMatch(publicPage, /Valuation-backed machinery/);
  assert.match(marketplaceDb, /options\.sellerUserId/);
  assert.match(marketplaceDb, /a\.user_id = \$1/);
});

test('public showroom presents clear business details in a white seller-scoped Marketplace', async () => {
  const [publicPage, manager, managerCss, marketplace, marketplaceCss] = await Promise.all([
    read('app/showroom/[slug]/page.tsx'),
    read('components/MiddlemanShowroomClient.tsx'),
    read('components/MiddlemanShowroomClient.module.css'),
    read('app/marketplace/marketplace-client.tsx'),
    read('app/marketplace/page.module.css'),
  ]);

  const publicShowroom = manager.slice(manager.indexOf('export function PublicMiddlemanShowroom'));
  const publicAdvertSummaryRule = managerCss.match(/\.publicAdvertSummary\s*\{[^}]*\}/)?.[0] ?? '';
  const inventorySummaryRule = managerCss.match(/\.inventorySummary\s*\{[^}]*\}/)?.[0] ?? '';

  assert.match(publicPage, /sellerUserId: showroom\.userId/);
  assert.match(publicPage, /exposeContact: true/);
  assert.match(publicShowroom, /showroom\.logoUrl \? <img src=\{showroom\.logoUrl\} alt=\{`\$\{showroom\.name\} logo`\}/);
  assert.match(publicShowroom, /<span aria-hidden="true">\{showroom\.name\.slice\(0, 2\)\.toUpperCase\(\)\}<\/span>/);
  assert.match(publicShowroom, /<h1>\{showroom\.name\}<\/h1>/);
  assert.match(publicShowroom, /className=\{styles\.publicAdvertSummary\}>\{listings\.length\} live/);
  assert.match(publicShowroom, /showroom\.bio \? <p className=\{styles\.publicBio\}>\{showroom\.bio\}<\/p>/);
  assert.match(publicShowroom, /className=\{styles\.publicAdvertSummary\}[\s\S]*?className=\{styles\.publicTrustLine\}[\s\S]*?className=\{styles\.publicContactActions\}/);
  assert.match(publicShowroom, /className=\{styles\.publicContactActions\} role="group" aria-label=\{`\$\{showroom\.name\} contact options`\}/);
  assert.match(publicShowroom, /className=\{styles\.publicBusinessDetails\}/);
  for (const icon of ['location', 'phone', 'email', 'website']) {
    assert.match(publicShowroom, new RegExp(`ShowroomDetailIcon name="${icon}"`));
  }
  assert.match(manager, /function ShowroomDetailIcon/);
  assert.match(manager, /<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.match(publicShowroom, /className=\{styles\.publicBusinessDetailCopy\}/);
  assert.match(publicShowroom, /showroom\.location/);
  assert.match(publicShowroom, /href=\{whatsappHref\(showroom\.phone\)\}/);
  assert.match(publicShowroom, /href=\{`tel:\$\{showroom\.phone\}`\}/);
  assert.match(publicShowroom, /href=\{`mailto:\$\{showroom\.email\}`\}/);
  assert.match(publicShowroom, /href=\{showroom\.websiteUrl\} target="_blank" rel="noreferrer"/);
  assert.match(publicShowroom, /websiteLabel\(showroom\.websiteUrl\)/);
  assert.match(publicShowroom, /className=\{styles\.inventorySummary\}>\{listings\.length\} live/);
  assert.match(publicShowroom, /Clear equipment details and direct seller contact\./);
  assert.match(publicShowroom, /Browse equipment listed by \{showroom\.name\} and contact the seller directly\./);
  assert.match(publicShowroom, /Professional machinery advertising and direct seller contact\./);
  assert.doesNotMatch(publicShowroom, /valuation-backed equipment|Every advert is backed by an Aim4price valuation|advertising backed by valuations/i);
  assert.doesNotMatch(publicAdvertSummaryRule, /border(?:-radius)?:|background:/);
  assert.doesNotMatch(inventorySummaryRule, /border(?:-radius)?:|background:/);

  assert.doesNotMatch(publicShowroom, /styles\.(?:publicHeroSummary|trustStrip|inventoryIcon|inventoryCount)/);
  assert.doesNotMatch(managerCss, /\.(?:publicHeroSummary|trustStrip|inventoryIcon|inventoryCount)\s*\{/);
  assert.doesNotMatch(managerCss, /\.publicHero\s*\{[^}]*linear-gradient/);
  assert.match(managerCss, /\.publicPage\s*\{[^}]*background:\s*#fff/);
  assert.match(managerCss, /\.publicHeroInner\s*\{[^}]*width:\s*min\(1540px,100%\)[^}]*background:\s*#fff/);
  assert.match(managerCss, /\.publicHeroMain\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\) minmax\(30rem,\.72fr\)/);
  assert.match(managerCss, /\.profileIdentity h1\s*\{[^}]*font-size:\s*clamp\(2rem,3\.15vw,3\.2rem\)/);
  assert.match(managerCss, /\.publicContactActions\s*\{[^}]*display:\s*grid;[^}]*repeat\(auto-fit,minmax\(9\.6rem,1fr\)\)/);
  assert.match(managerCss, /\.publicBusinessDetails > \*\s*\{[^}]*grid-template-columns:\s*2\.1rem minmax\(0,1fr\)/);
  assert.match(managerCss, /\.publicBusinessDetails svg\s*\{[^}]*stroke:\s*#285d4d/);
  assert.match(managerCss, /@media \(max-width: 560px\)[\s\S]*?\.publicContactActions\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.match(managerCss, /\.publicFooter\s*\{[^}]*background:\s*#fff/);
  assert.match(managerCss, /font-family: 'Montserrat'/);
  assert.doesNotMatch(managerCss, /text-transform:\s*uppercase/);

  assert.match(publicShowroom, /<MarketplaceClient[\s\S]*?initialListings=\{listings\}[\s\S]*?embeddedMode[\s\S]*?showroomMode[\s\S]*?exposeSellerContact/);
  assert.match(marketplace, /if \(showroomMode\) \{[\s\S]*?setItems\(initialListings \?\? \[\]\)[\s\S]*?return undefined/);
  assert.match(marketplace, /!showroomMode \? \([\s\S]*?Create new listing/);
  assert.match(marketplace, /placeholder=\{showroomMode \? 'Search this showroom' : 'Search Marketplace'\}/);
  assert.match(marketplace, /const canExposeSellerContact = isSignedIn \|\| exposeSellerContact/);
  assert.match(marketplace, /canExposeSellerContact \? \([\s\S]*?href=\{`tel:\$\{activeListing\.sellerPhone/);
  assert.match(marketplace, /href=\{`mailto:\$\{activeListing\.sellerEmail\}`\}/);

  assert.match(marketplace, /const showroomHasNoInventory = showroomMode && !isLoadingListings && items\.length === 0/);
  assert.match(marketplace, /showroomHasNoInventory \? \(/);
  assert.match(marketplace, /No equipment listed yet/);
  assert.match(marketplace, /This showroom has no live adverts at the moment\. Please check back soon\./);
  assert.doesNotMatch(marketplace, /styles\.showroomEmptyIcon/);
  assert.doesNotMatch(marketplaceCss, /\.showroomEmptyIcon\s*\{/);
  assert.match(marketplace, /Nothing matches those filters/);
  assert.match(marketplace, /showroomMode \? 'Clear filters' : 'Reset marketplace'/);
  assert.match(marketplace, /className=\{`\$\{styles\.page\} \$\{showroomMode \? styles\.showroomPage : ''\}/);
  assert.match(marketplaceCss, /\.showroomPage\s*\{[^}]*background:\s*#fff;[^}]*font-family: var\(--font-body, 'Montserrat'\)/);
  assert.match(marketplaceCss, /\.showroomPage \*\s*\{[\s\S]*?font-variant-caps:\s*normal/);
  assert.match(marketplaceCss, /\.showroomPage \.placeholderPill,[\s\S]*?text-transform:\s*none/);
  assert.match(marketplaceCss, /\.showroomSidebar\s*\{[^}]*background:\s*#fff/);
  assert.match(marketplaceCss, /\.showroomResults \.listingCard\s*\{/);
  assert.match(marketplaceCss, /\.showroomEmptyState\s*\{[^}]*background:\s*#fff/);
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

test('private showroom exposes advert design only when the server grants Brand Kit editing', async () => {
  const [manager, myShowroomPage, dealerShowroomPage, desktopAdStudioPage, brandKitRoute, header] = await Promise.all([
    read('components/MiddlemanShowroomClient.tsx'),
    read('app/my-showroom/page.tsx'),
    read('app/dealer/showroom/page.tsx'),
    read('app/ad-studio/page.tsx'),
    read('app/api/ad-studio/brand-kits/route.ts'),
    read('components/AppHeader.tsx'),
  ]);

  const ownerNav = header.match(/const OWNER_NAV_ITEMS: NavItem\[\] = \[[\s\S]*?\n\];/)?.[0] ?? '';

  assert.match(manager, /advertDesignHref\?: string \| null/);
  assert.match(manager, /\{advertDesignHref \? \([\s\S]*?<Link className=\{styles\.advertDesignButton\} href=\{advertDesignHref\}>Edit advert design<\/Link>[\s\S]*?\) : null\}/);
  assert.doesNotMatch(manager, /dealerAppMode\s*\?[^:]*Edit advert design/);
  assert.match(myShowroomPage, /advertDesign=\{profile\.accountType === 'dealer' \? 'saved-brand' : 'aim4price-marketplace'\}/);
  assert.match(myShowroomPage, /advertDesignHref=\{profile\.accountType === 'dealer' \? '\/ad-studio' : null\}/);
  assert.match(dealerShowroomPage, /advertDesign="saved-brand"/);
  assert.match(dealerShowroomPage, /advertDesignHref=\{!dealerAppSession \|\| dealerAppSession\.role === 'owner' \? '\/dealer\/ad-studio' : null\}/);
  assert.match(desktopAdStudioPage, /profile\.accountType !== 'dealer'/);
  assert.match(brandKitRoute, /profile\.accountType !== 'dealer'/);
  assert.match(brandKitRoute, /canManage: !dealerSession \|\| dealerSession\.role === 'owner'/);
  assert.doesNotMatch(ownerNav, /ad-studio/i);
});

test('Owner showroom JPEGs stay standard while Dealer and Middleman Brand Kits remain available', async () => {
  const [manager, rendererSource, marketplace] = await Promise.all([
    read('components/MiddlemanShowroomClient.tsx'),
    read('lib/marketplace-ad-renderer.ts'),
    read('app/marketplace/marketplace-client.tsx'),
  ]);

  const defaultColors = {
    primary: '#165340',
    secondary: '#0d3329',
    accent: '#f2b84b',
  };
  const { marketplaceListingToAdContent, renderMarketplaceAdCanvas } = await loadTypeScriptModule(
    'lib/marketplace-ad-renderer.ts',
    {
      './ad-studio': { AD_TEMPLATE_OPTIONS: [], DEFAULT_AD_BRAND_COLORS: defaultColors },
      './marketplace': { calculateMarketplaceDealRating: () => ({ rating: 'fair' }) },
    },
  );
  const customBrand = {
    name: 'Dealer premium',
    templateId: 'minimal',
    logoUrl: 'https://example.com/dealer-logo.png',
    primaryColor: '#AA1122',
    secondaryColor: '#223344',
    accentColor: '#BBCCDD',
    businessName: 'Dealer Equipment',
    contactName: 'Sam Seller',
    phone: '0821234567',
    email: 'sales@example.com',
    website: 'https://example.com',
    language: 'af',
    vatLabel: 'vat-included',
  };
  const listing = {
    id: 'listing-1',
    title: '2020 Example Tractor',
    askingPriceExVat: 500000,
    sellerName: 'Fallback Seller',
    sellerPhone: '0110000000',
    sellerCompany: 'Fallback Company',
    sellerEmail: 'fallback@example.com',
    adBrand: customBrand,
  };

  const branded = marketplaceListingToAdContent(listing);
  const standard = marketplaceListingToAdContent(listing, { design: 'aim4price-marketplace' });
  const ownerStandard = marketplaceListingToAdContent({ ...listing, adBrand: undefined });

  assert.match(manager, /advertDesign = 'aim4price-marketplace'/);
  assert.match(manager, /const usesSavedBrandDesign = advertDesign === 'saved-brand'/);
  assert.match(manager, /design: usesSavedBrandDesign && listing\.adBrand \? 'saved-brand' : 'aim4price-marketplace'/);
  assert.match(marketplace, /design: isDealerAccount && listing\.adBrand \? 'saved-brand' : 'aim4price-marketplace'/);
  assert.match(rendererSource, /export type MarketplaceAdDesign = 'saved-brand' \| 'aim4price-marketplace'/);
  assert.match(rendererSource, /options\.design \?\? \(listing\.adBrand \? 'saved-brand' : 'aim4price-marketplace'\)/);
  assert.match(rendererSource, /AIM4PRICE_STANDARD_LOGO_SRC = '\/brand\/Aim4price_Home_Logo\.png'/);
  assert.match(rendererSource, /AIM4PRICE_STANDARD_WATERMARK_SRC = '\/brand\/aim4price-mark-black\.png'/);
  assert.match(rendererSource, /content\.design === 'aim4price-marketplace'[\s\S]*?renderAim4priceStandardCanvas/);
  assert.match(rendererSource, /drawAim4priceStandardDetail\(context, 'Year'/);
  assert.match(rendererSource, /drawAim4priceStandardDetail\(context, 'Condition'/);
  assert.equal(branded.brand.templateId, 'minimal');
  assert.equal(branded.brand.primaryColor, customBrand.primaryColor);
  assert.equal(branded.design, 'saved-brand');
  assert.equal(standard.brand.name, 'Aim4price standard');
  assert.equal(standard.brand.templateId, 'showcase');
  assert.equal(standard.design, 'aim4price-marketplace');
  assert.equal(standard.brand.primaryColor, defaultColors.primary);
  assert.equal(standard.brand.secondaryColor, defaultColors.secondary);
  assert.equal(standard.brand.accentColor, defaultColors.accent);
  for (const field of ['logoUrl', 'businessName', 'contactName', 'phone', 'email', 'website', 'language', 'vatLabel']) {
    assert.equal(standard.brand[field], customBrand[field]);
  }
  assert.equal(standard.sellerCompany, customBrand.businessName);
  assert.equal(standard.sellerName, customBrand.contactName);
  assert.equal(standard.sellerPhone, customBrand.phone);
  assert.equal(ownerStandard.design, 'aim4price-marketplace');
  assert.equal(ownerStandard.brand.name, 'Aim4price standard');
  assert.equal(ownerStandard.brand.templateId, 'showcase');

  const drawnText = [];
  const gradient = { addColorStop() {} };
  const drawingContext = new Proxy({
    createLinearGradient: () => gradient,
    measureText: (value) => ({ width: String(value).length * 10 }),
    fillText: (value) => drawnText.push(String(value)),
  }, {
    get(target, property) {
      if (property in target) return target[property];
      return () => undefined;
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
  const canvas = { width: 0, height: 0, getContext: () => drawingContext };
  const renderedTemplate = await renderMarketplaceAdCanvas(canvas, ownerStandard, { includeImages: false });
  assert.equal(renderedTemplate, 'showcase');
  assert.equal(canvas.width, 1600);
  assert.equal(canvas.height, 900);
  assert.ok(drawnText.includes('Aim4price'));
  assert.ok(drawnText.includes('Year'));
  assert.ok(drawnText.includes('Condition'));
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
  const [route, database] = await Promise.all([
    read('app/api/marketplace/route.ts'),
    read('lib/marketplace-db.ts'),
  ]);

  assert.match(route, /brandKitId: accountType === 'dealer' \? brandKitId \|\| null : null/);
  assert.match(route, /allowBrandKit: accountType === 'dealer'/);
  assert.match(database, /const brandKit = input\.allowBrandKit[\s\S]*?getAdBrandKitForUser\(input\.userId, requestedBrandKitId \|\| null\)/);
  assert.match(database, /if \(input\.allowBrandKit && requestedBrandKitId && !brandKit\)/);
  assert.match(database, /updateValues\.push\(brandKit \? JSON\.stringify\(toAdBrandSnapshot\(brandKit\)\) : null\)/);
  assert.match(database, /marketplace_ad_brand = \$\$\{updateValues\.length\}::jsonb/);
});
