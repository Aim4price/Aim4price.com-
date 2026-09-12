import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Share Asset opens the inside or outside Aim4price choice before either flow', async () => {
  const [client, component] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /type AssetShareDestination = 'choice' \| 'inside' \| 'outside'/);
  assert.match(client, /setAssetShareDestination\('choice'\);[\s\S]*?setQuoteAsset\(asset\)/);
  assert.equal((client.match(/<AssetShareDestinationPicker/g) ?? []).length, 2);
  assert.equal((client.match(/<AssetExternalShare/g) ?? []).length, 2);
  assert.match(client, /onInside=\{\(\) => setAssetShareDestination\('inside'\)\}/);
  assert.match(client, /onOutside=\{\(\) => setAssetShareDestination\('outside'\)\}/);
  assert.match(component, /<strong>Inside Aim4price<\/strong>/);
  assert.match(component, /<strong>Outside Aim4price<\/strong>/);
});

test('outside sharing stays in one simple modal with optional photos, controlled reports and two send actions', async () => {
  const [client, component] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(client, /function buildExternalShareAsset/);
  assert.match(client, /serialNumber: asset\.serialNumber/);
  assert.match(client, /yearModel: asset\.yearModel/);
  assert.match(client, /usage: buildAssetUsageValue\(asset\)/);
  assert.match(client, /condition: conditionLabel\(asset\.condition\)/);
  assert.match(client, /replacementPriceExVat: readAssetReplacementPriceExVat\(asset\)/);
  assert.match(client, /valueExVat: asset\.value/);
  assert.match(client, /normalizePhotos\(asset\.photos\)\.flatMap/);
  assert.match(client, /toAbsoluteUrl\(photoUrl\)/);

  assert.match(component, /const \[includePhotos, setIncludePhotos\] = useState\(false\)/);
  assert.match(component, /<strong>Include saved photos<\/strong>/);
  assert.match(component, /type="checkbox" checked=\{includePhotos\}/);
  assert.match(component, /onAddAim4priceReport: \(\) => void/);
  assert.match(component, /onRemoveAim4priceReport: \(reportId: string\) => void/);
  assert.match(component, /<strong>\{reportFiles\.length \? 'Add another Aim4price report' : 'Add Aim4price report'\}<\/strong>/);
  assert.match(component, /reportFiles\.map\(\(report\) =>/);
  assert.match(component, /onRemoveAim4priceReport\(reportId\)/);

  assert.match(component, /createExternalShareFileCache\(\)/);
  assert.match(component, /prepareExternalShareFiles\(selectedSources, attachmentFileCache\)/);
  assert.match(component, /function photoShareUrl\(url: string\)/);
  assert.match(component, /parsed\.searchParams\.set\('share', '1'\)/);
  assert.match(component, /const preparedUrl = photoShareUrl\(url\)/);
  assert.match(component, /credentials: credentialsForUrl\(preparedUrl\),[\s\S]*?url: preparedUrl/);
  assert.doesNotMatch(component, /MAX_SHARE_FILES|Choose no more than .* attachments/, 'all selected photos and reports should be prepared together');
  assert.match(component, /file\.size > MAX_SHARE_FILE_BYTES/);
  assert.match(component, /totalBytes > MAX_SHARE_TOTAL_BYTES/);
  assert.match(component, /const shareData: ShareData = \{[\s\S]*?files: preparation\.files,[\s\S]*?title: copy\.subject,[\s\S]*?text: copy\.body/);
  assert.match(component, /navigator\.canShare\(shareData\)/);
  assert.match(component, /navigator\.share\(shareData\)/);
  assert.equal((component.match(/navigator\.share\(/g) ?? []).length, 1, 'all selected files should be handed over in one share call');

  const sendHandler = component.match(/async function sendShare\(target: ShareTarget\) \{([\s\S]*?)\n  \}\n\n  const attachmentStatus/);
  assert.ok(sendHandler, 'the component should expose one send handler');
  assert.doesNotMatch(sendHandler[1], /fetchExternalShareFile|prepareExternalShareFiles/, 'network preparation should finish before the user presses Send');

  assert.match(component, /'Send by email'/);
  assert.match(component, /'Send with WhatsApp'/);
  assert.equal((component.match(/className=\{`\$\{styles\.sendButton\}/g) ?? []).length, 2);
  assert.match(component, /window\.location\.assign\(emailHref\)/);
  assert.match(component, /window\.open\(whatsappHref/);

  assert.doesNotMatch(component, /Copy message/);
  assert.doesNotMatch(component, /Photos &amp; files/);
  assert.doesNotMatch(component, /Saved documents/);
  assert.doesNotMatch(component, /Add any file/);
  assert.doesNotMatch(component, /Open report studio/);
  assert.doesNotMatch(component, /type="file"/);
  assert.doesNotMatch(component, /createExternalShareArchive/);
  assert.doesNotMatch(component, /Download one ZIP|ZIP package|message-only fallback/i);
  assert.doesNotMatch(component, /setView\(|choose-files|readyPanel|filePickerPanel/);
});

test('the official filled WhatsApp glyph is used instead of a custom outline handset', async () => {
  const component = await readFile(new URL('../components/asset-register/AssetExternalShare.tsx', import.meta.url), 'utf8');

  assert.match(component, /function WhatsAppIcon[\s\S]*?<svg viewBox="0 0 24 24" fill="currentColor"/);
  assert.match(component, /<path d="M17\.472 14\.382c-\.297-\.149-1\.758-\.867/);
  assert.doesNotMatch(component, /function WhatsAppIcon[\s\S]*?<path fill="currentColor" stroke="none" d="M8\.05 6\.95/);
});

test('the existing internal partner choices remain in the inside Aim4price path', async () => {
  const client = await readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');

  assert.match(client, /assetShareDestination === 'outside'[\s\S]*?assetShareInsideFlow/);
  assert.match(client, /Finance &amp; accounting/);
  assert.match(client, /<strong>Insurance<\/strong>/);
  assert.match(client, /<strong>Dealer<\/strong>/);
  assert.match(client, /<strong>Licence renewal<\/strong>/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('finance'\)/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('insurance'\)/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('replacement_quote'\)/);
  assert.match(client, /openFullRegisterQuotePartnerPicker\('license_renewal'\)/);
});

test('inside choices remain compact while the simplified outside layout has balanced spacing and two responsive actions', async () => {
  const [client, pageStyles, component, componentStyles] = await Promise.all([
    readFile(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../components/asset-register/AssetExternalShare.module.css', import.meta.url), 'utf8'),
  ]);

  assert.equal((client.match(/styles\.assetShareInsideModal/g) ?? []).length, 2);
  assert.match(pageStyles, /\.assetQuoteModal\.assetShareInsideModal:not\(\.assetQuotePartnerPickerModal\) \.assetQuoteChoiceGrid,[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(pageStyles, /\.assetShareInsideModal \.assetQuoteChoiceGrid \.assetQuoteChoiceCard[\s\S]*?min-height: clamp\(7\.8rem, (?:calc\(var\(--website-design-vh(?:, 1dvh)?\) \* 14\)|calc\(var\(--website-visible-height(?:, 100dvh)?\) \* 0\.14\)), 8\.8rem\) !important/);
  assert.match(pageStyles, /@media \(max-width: 820px\)[\s\S]*?\.assetQuoteModal\.assetShareInsideModal:not\(\.assetQuotePartnerPickerModal\) \.assetQuoteChoiceGrid,[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important/);

  const insideScrollRule = pageStyles.match(/\.assetShareInsideModal \.assetQuoteScrollBody,\n\.assetShareInsideModal \.registerShareModalBody \{\n([\s\S]*?)\n\}/);
  assert.ok(insideScrollRule, 'inside sharing should size naturally without a permanent scrollbar gutter');
  assert.match(insideScrollRule[1], /overflow-y: visible !important/);
  assert.match(insideScrollRule[1], /scrollbar-gutter: auto !important/);

  assert.match(componentStyles, /\.externalPanel \{[\s\S]*?gap: 1\.25rem/);
  assert.match(componentStyles, /\.shareLayout \{[\s\S]*?grid-template-columns: minmax\(0, 1\.48fr\) minmax\(19rem, 0\.78fr\)[\s\S]*?gap: 1\.25rem/);
  assert.match(componentStyles, /\.messageCard,[\s\S]*?padding: 1\.25rem 1\.375rem;[\s\S]*?border-radius: 1\.125rem/);
  assert.match(componentStyles, /\.messagePreview::\-webkit-scrollbar-thumb/);
  assert.match(componentStyles, /\.sendFooter \{[\s\S]*?padding-top: 1\.125rem/);
  assert.doesNotMatch(componentStyles.match(/^\.sendFooter \{([^}]+)\}/m)?.[1] ?? '', /position: sticky/);
  assert.match(componentStyles, /\.accountShareTheme \.sendFooter \{[^}]*position: sticky/);
  assert.match(componentStyles, /\.sendButtons \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[\s\S]*?gap: 0\.75rem/);
  assert.match(componentStyles, /@media \(max-width: 620px\)[\s\S]*?\.sendButtons \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(componentStyles, /\.sendButton \{[\s\S]*?min-height: 3\.75rem/);
  assert.match(componentStyles, /\.whatsappButton \{[\s\S]*?#25d366[\s\S]*?#128c7e/);
  assert.match(componentStyles, /\.whatsappButton \.sendIcon svg \{[\s\S]*?width: 1\.72rem;[\s\S]*?height: 1\.72rem/);
  assert.match(component, /tabIndex=\{0\}[\s\S]*?aria-label="External asset details message preview"/);
});

