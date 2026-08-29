import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Owner, Field Manager and Dealer staff access use one clear New and Manage launcher', async () => {
  const [shared, dealer, owner, field] = await Promise.all([
    read('app/account/app-access-management-client.tsx'),
    read('app/account/dealer-app/dealer-access-client.tsx'),
    read('app/account/owner-app/owner-app-access-client.tsx'),
    read('app/account/field-manager/field-manager-client.tsx'),
  ]);

  assert.match(shared, /<strong>New<\/strong>/);
  assert.match(shared, /<strong>Manage<\/strong>/);
  assert.match(shared, /onNew=\{\(\) => openFlow\('new'\)\}/);
  assert.match(shared, /onManage=\{\(\) => openFlow\('manage'\)\}/);
  assert.match(shared, /open=\{activeFlow === 'new'\}/);
  assert.match(shared, /open=\{activeFlow === 'manage'\}/);
  assert.match(shared, /title=\{selectedRecord \? `Manage \$\{selectedRecord\.displayName\}` : config\.itemPlural\}/);

  assert.match(dealer, /<DealerAppAccessManagement middlemanMode=\{middlemanMode\} \/>/);
  assert.match(owner, /OwnerAppAccessManagement as default/);
  assert.match(field, /FieldManagerAppAccessManagement as default/);
});

test('shared access flows preserve each app login type and its existing controls', async () => {
  const shared = await read('app/account/app-access-management-client.tsx');

  assert.match(shared, /listEndpoint: '\/api\/dealer\/staff'/);
  assert.match(shared, /listEndpoint: '\/api\/owner-app\/users'/);
  assert.match(shared, /listEndpoint: '\/api\/field-managers'/);
  assert.match(shared, /roleField: 'role'/);
  assert.match(shared, /roleField: 'accessRole'/);
  assert.match(shared, /roleField: null/);
  assert.match(shared, /Owner \/ Manager/);
  assert.match(shared, /Operations/);
  assert.match(shared, /FieldManagerAccessPanel/);
  assert.match(shared, /Save access/);
  assert.match(shared, /Deactivate/);
  assert.match(shared, /Activate/);
  assert.match(shared, /Delete/);
  assert.match(shared, /Copy link/);
  assert.match(shared, /Share link/);
});

test('every app access page exposes an allowlisted QR install handoff', async () => {
  const [shared, route, styles, ownerLogin, dealerLogin] = await Promise.all([
    read('app/account/app-access-management-client.tsx'),
    read('app/api/account/app-access-qr/route.ts'),
    read('app/account/app-access-management.module.css'),
    read('app/owner-app/login/page.tsx'),
    read('app/dealer/login/page.tsx'),
  ]);

  assert.match(shared, /loginPath: '\/dealer\/login',[\s\S]*?qrApp: 'dealer'/);
  assert.match(shared, /loginPath: '\/owner-app\/login',[\s\S]*?qrApp: 'owner'/);
  assert.match(shared, /loginPath: '\/field-manager\/login',[\s\S]*?qrApp: 'field'/);
  assert.match(shared, /src=\{`\/api\/account\/app-access-qr\?app=\$\{config\.qrApp\}`\}/);
  assert.match(shared, /Scan to open or install app/);
  assert.match(shared, /source=qr&install=1/);
  assert.match(shared, /onError=\{\(\) => setImageFailed\(true\)\}/);

  assert.match(route, /dealer: '\/dealer\/login\?source=qr&install=1'/);
  assert.match(route, /owner: '\/owner-app\/login\?source=qr&install=1'/);
  assert.match(route, /field: '\/field-manager\/login\?source=qr&install=1'/);
  assert.match(route, /value === 'dealer' \|\| value === 'owner' \|\| value === 'field'/);
  assert.match(route, /status: 400/);
  assert.match(route, /QR_PROVIDER_ORIGIN = 'https:\/\/api\.qrserver\.com'/);
  assert.match(route, /url\.searchParams\.set\('format', 'png'\)/);
  assert.match(route, /contentType !== 'image\/png'/);
  assert.match(route, /MAX_QR_BYTES/);
  assert.doesNotMatch(route, /searchParams\.get\(['"](?:url|target)['"]\)/);

  for (const loginPage of [ownerLogin, dealerLogin]) {
    assert.match(loginPage, /forceInstallHandoff = isInstallHandoff\(searchParams\)/);
    assert.match(loginPage, /!forceInstallHandoff/);
  }

  assert.match(styles, /\.qrImageFrame \{[\s\S]*?aspect-ratio: 1 \/ 1/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*?\.loginStrip \{[\s\S]*?grid-template-columns: 1fr/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.qrHandoff \{[\s\S]*?grid-template-columns: 6\.25rem minmax\(0, 1fr\)/);
});

test('the login URL and link actions match the polished QR handoff', async () => {
  const [shared, styles] = await Promise.all([
    read('app/account/app-access-management-client.tsx'),
    read('app/account/app-access-management.module.css'),
  ]);

  assert.match(shared, /className=\{styles\.loginLinkCard\}/);
  assert.match(shared, /className=\{styles\.loginLinkIcon\}><LinkIcon \/>/);
  assert.match(shared, /className=\{styles\.loginUrl\}[\s\S]*?href=\{loginLink\}/);
  assert.match(shared, /className=\{styles\.linkButtonIcon\}><CopyIcon \/>/);
  assert.match(shared, /className=\{styles\.linkButtonIcon\}><ShareIcon \/>/);
  assert.match(shared, /<strong>Copy link<\/strong><small>Clipboard<\/small>/);
  assert.match(shared, /<strong>Share link<\/strong><small>Send access<\/small>/);
  const launcherStart = shared.indexOf('function AccessLauncher');
  const launcherEnd = shared.indexOf('function InlineNotice', launcherStart);
  const launcher = shared.slice(launcherStart, launcherEnd);

  assert.match(launcher, /const streamlinedLauncher = config\.qrApp === 'owner' \|\| config\.qrApp === 'field'/);
  assert.match(
    launcher,
    /\{streamlinedLauncher \? null : \(\s*<span className=\{styles\.actionMeta\}>\s*<span className=\{styles\.actionArrow\}/,
  );
  assert.match(
    launcher,
    /className=\{styles\.countPill\}[\s\S]*?\{streamlinedLauncher \? null : \(\s*<span className=\{styles\.actionArrow\}/,
  );
  assert.match(
    launcher,
    /\{streamlinedLauncher \? null : \(\s*<span className=\{styles\.loginLabel\}/,
  );
  assert.equal(
    (launcher.match(/className=\{styles\.actionArrow\}/g) ?? []).length,
    2,
  );
  assert.match(launcher, /aria-label=\{`Open \$\{config\.loginLinkLabel\}`\}/);
  assert.match(launcher, /aria-label=\{`Copy \$\{config\.loginLinkLabel\}`\}/);
  assert.match(launcher, /aria-label=\{`Share \$\{config\.loginLinkLabel\}`\}/);
  assert.equal(
    (launcher.match(/\{streamlinedLauncher \? null : \(\s*<span className=\{styles\.linkButtonCopy\}/g) ?? []).length,
    2,
  );

  assert.match(styles, /\.loginLinkCard \{[\s\S]*?min-height: 8\.35rem;[\s\S]*?linear-gradient\(145deg, #ffffff 0%, #f1f7fb 100%\)/);
  assert.match(styles, /\.loginUrl \{[\s\S]*?border-radius: 0\.78rem;[\s\S]*?background: rgba\(255, 255, 255, 0\.88\)/);
  assert.match(styles, /\.loginActions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(8rem, 1fr\)\)/);
  assert.match(styles, /\.linkButton \{[\s\S]*?min-height: 8\.35rem;[\s\S]*?border-radius: 1rem/);
  assert.match(styles, /\.linkButtonPrimary \{[\s\S]*?linear-gradient\(145deg, #238c68 0%, #12553e 100%\)/);
  assert.match(styles, /\.loginStripStreamlined \{[\s\S]*?grid-template-columns: minmax\(15rem, 0\.9fr\) minmax\(18rem, 1\.35fr\) auto/);
  assert.match(styles, /\.loginStripStreamlined \.loginUrl code \{[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap/);
  assert.match(styles, /\.loginActions\.loginActionsIconOnly \{[\s\S]*?grid-template-columns: 3\.5rem;[\s\S]*?grid-template-rows: repeat\(2, 3\.5rem\)/);
  assert.match(styles, /\.linkButton\.linkButtonIconOnly \{[\s\S]*?width: 3\.5rem;[\s\S]*?height: 3\.5rem;[\s\S]*?min-height: 3\.5rem/);
  assert.match(
    styles,
    /@media \(max-width: 820px\)[\s\S]*?\.loginStripStreamlined \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?\.loginStripStreamlined \.qrHandoff \{[\s\S]*?grid-column: 1 \/ -1/,
  );
});

test('all Manage directories and access choices stay alphabetical after every update', async () => {
  const shared = await read('app/account/app-access-management-client.tsx');

  assert.match(shared, /const ACCESS_DIRECTORY_COLLATOR = new Intl\.Collator\('en-ZA'/);
  assert.match(shared, /function sortAccessRecords\(records: AccessRecord\[\]\)/);
  assert.match(shared, /const nextRecords = sortAccessRecords\(readRecordList\(payload, config\.listKey\)\)/);
  assert.match(shared, /setRecords\(\(current\) => sortAccessRecords\(\[\.\.\.current, created\]\)\)/);
  assert.match(shared, /setRecords\(\(current\) => sortAccessRecords\(current\.map/);
  assert.match(shared, /setAssets\(sortAccessOptions\(payload\.assets \?\? \[\], \(asset\) => asset\.title\)\)/);
  assert.match(shared, /setGroups\(sortAccessOptions\(payload\.groups \?\? \[\], \(group\) => group\.name\)\)/);
  assert.match(shared, /setStorages\(sortAccessOptions\(payload\.storages \?\? \[\], \(storage\) => storage\.name\)\)/);
});

test('the header Manage popover always sorts visible destinations alphabetically', async () => {
  const header = await read('components/AppHeader.tsx');

  assert.match(header, /const ACCOUNT_MENU_COLLATOR = new Intl\.Collator\('en-ZA'/);
  assert.match(header, /function sortAccountMenuItems<T extends \{ href: string; label: string \}>/);
  assert.match(header, /ACCOUNT_MENU_COLLATOR\.compare\(left\.label, right\.label\)/);
  assert.match(header, /sortAccountMenuItems\(navItems\.filter\(\(item\) => item\.href !== '\/'\)\)\.map/);
  assert.match(header, /sortAccountMenuItems\(session\?\.accountType === 'licensing'/);
});

test('access launcher and dialogs stay large, focused and responsive', async () => {
  const [shared, styles] = await Promise.all([
    read('app/account/app-access-management-client.tsx'),
    read('app/account/app-access-management.module.css'),
  ]);

  assert.match(styles, /\.actionGrid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.actionButton \{[\s\S]*?min-height: clamp\(9rem, 14vw, 11\.5rem\)/);
  assert.match(styles, /\.modalOverlay \{[\s\S]*?position: fixed;[\s\S]*?z-index: 12000/);
  assert.match(styles, /\.modalBody \{[\s\S]*?overflow-y: auto/);
  assert.match(styles, /\.modalWide \{[\s\S]*?width: min\(100%, 72rem\)/);
  assert.match(styles, /\.modalHeader p \{[\s\S]*?font-size: 1rem/);
  assert.match(styles, /\.surfaceHeader h3 \{[\s\S]*?font-size: 1\.2rem/);
  assert.match(styles, /\.directoryHeader strong \{[\s\S]*?font-size: 1\.05rem/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.actionGrid \{[\s\S]*?grid-template-columns: 1fr/);

  assert.match(shared, /const onCloseRef = useRef\(onClose\)/);
  assert.match(shared, /const closeDisabledRef = useRef\(closeDisabled\)/);
  assert.match(shared, /if \(event\.key === 'Escape' && !closeDisabledRef\.current\) onCloseRef\.current\(\)/);
  assert.match(shared, /\}, \[open\]\);/);
});
