import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('global layout tokens provide fluid gutters, spacing and stable text scaling', async () => {
  const globals = await read('app/globals.css');

  assert.match(globals, /--shell-width: min\(calc\(100% - \(var\(--shell-gutter\) \* 2\)\), var\(--shell-max\)\)/);
  assert.match(globals, /--layout-section-gap: clamp\(/);
  assert.match(globals, /--layout-card-gap: clamp\(/);
  assert.match(globals, /--control-min-height: 44px/);
  assert.match(globals, /-webkit-text-size-adjust: 100%/);
  assert.match(globals, /\.appRoot,[\s\S]*?\.appRoot > main,[\s\S]*?main \{[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%/);
});

test('header keeps the complete desktop navigation on the fixed mobile canvas', async () => {
  const [header, headerClient, layout] = await Promise.all([
    read('components/AppHeader.module.css'),
    read('components/AppHeader.tsx'),
    read('app/layout.tsx'),
  ]);

  assert.match(header, /Responsive shell contract, August 2026/);
  assert.match(header, /@media \(min-width: 761px\) and \(max-width: 1180px\)[\s\S]*?\.nav \{[\s\S]*?display: grid;[\s\S]*?\.navRail \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(header, /@media \(min-width: 761px\) and \(max-width: 1180px\)[\s\S]*?\.mobileMenuButton,[\s\S]*?\.mobileMenuPanel \{[\s\S]*?display: none/);
  assert.match(headerClient, /usesCompactHeader[\s\S]*?navItems\.length/);
  assert.match(layout, /width: 980/);
  assert.match(layout, /initialScale: -1/);
  assert.doesNotMatch(layout, /width: 'device-width'|initialScale: 1/);
  assert.match(headerClient, /window\.matchMedia\('\(max-width: 760px\)'\)/);
  assert.doesNotMatch(headerClient, /max-device-width/);
  assert.match(headerClient, /usesCompactHeader \? styles\.innerCompact/);
  assert.match(headerClient, /usesCompactHeader \? styles\.navCompact/);
  assert.match(headerClient, /\{ key: 'home', href: '\/', label: 'Home' \}/);
  assert.match(headerClient, /\{ key: 'valuation', href: '\/valuation', label: 'Get Estimate' \}/);
  assert.match(header, /\.innerCompact \{[\s\S]*?grid-template-areas: "brand actions";[\s\S]*?row-gap: 0/);
  assert.match(header, /\.navCompact \{[\s\S]*?display: none/);
  assert.doesNotMatch(header, /@media \(hover: none\) and \(pointer: coarse\) and \(max-device-width: 900px\)/);
  assert.doesNotMatch(header, /navSwipe/);
  assert.match(header, /@media \(max-width: 760px\)[\s\S]*?\.mobileMenuButton \{[\s\S]*?display: none;[\s\S]*?\.accountMenu \{[\s\S]*?display: block/);
  assert.match(headerClient, /!isLoadingSession && !session \? styles\.innerPublic/);
  assert.match(header, /@media \(max-width: 760px\)[\s\S]*?\.innerPublic \.actionsRail \{[\s\S]*?grid-template-columns: minmax\(3\.5rem, 0\.72fr\) minmax\(7rem, 1\.28fr\)/);
  assert.match(header, /\.innerPublic \.loginButton,[\s\S]*?\.innerPublic \.signupButton \{[\s\S]*?min-height: var\(--tap-target-min, 44px\)/);
  assert.match(header, /\.navWindowButton \{[\s\S]*?min-width: var\(--tap-target-min, 44px\)/);
});

test('website sign-out stays separate from installable app sessions and verifies closure', async () => {
  const [headerClient, sessionCache, meRoute] = await Promise.all([
    read('components/AppHeader.tsx'),
    read('lib/header-session-cache.ts'),
    read('app/api/me/route.ts'),
  ]);

  assert.match(sessionCache, /fetch\('\/api\/me\?scope=website'/);
  assert.match(meRoute, /export async function GET\(request: Request\)/);
  assert.match(meRoute, /searchParams\.get\('scope'\) === 'website'/);
  assert.match(meRoute, /websiteOnly[\s\S]*?\? await getServerSession\(\)[\s\S]*?: await getServerSession\(\{ allowDealerApp: true, allowOwnerApp: true \}\)/);
  assert.match(headerClient, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(headerClient, /keepalive: true/);
  assert.match(headerClient, /fetch\('\/api\/me\?scope=website'/);
  assert.match(headerClient, /verification\?\.signedIn !== false/);
  assert.match(headerClient, /clearCachedHeaderSession\(\)[\s\S]*?window\.location\.replace\('\/auth#login'\)/);
});

test('home page keeps the feature-led Asset Register hero usable at desktop, tablet and phone widths', async () => {
  const [home, hero, headerClient] = await Promise.all([
    read('app/page.module.css'),
    read('app/home-hero-experience.tsx'),
    read('components/AppHeader.tsx'),
  ]);
  const featureStart = home.indexOf(
    '/* === Feature-led living record homepage hero, September 2026 === */',
  );
  const feature = home.slice(featureStart);

  assert.ok(featureStart >= 0);
  assert.match(home, /Living Asset Record homepage hero, September 2026/);
  assert.match(hero, /HERO_STAGES: readonly QuestionKey\[\]/);
  assert.match(hero, /HERO_AUTOPLAY_DELAY_MS = 2500/);
  assert.match(hero, /HERO_AUTOPLAY_AFTER_INTRO_MS = 700/);
  assert.match(hero, /HERO_STAGE_DURATION_MS = 2800/);
  assert.match(hero, /HOME_INTRO_HOLD_MS = 1650/);
  assert.match(hero, /HOME_INTRO_EXIT_MS = 700/);
  assert.match(hero, /window\.matchMedia\(REDUCED_MOTION_QUERY\)/);
  assert.match(hero, /Every asset\.[\s\S]*?One living record\./);
  assert.match(hero, /Know what it really costs\./);
  assert.match(headerClient, /data-aim4price-header-mark/);
  assert.match(hero, /href="#choose-role" className=\{styles\.primaryCta\}/);
  assert.doesNotMatch(hero, /heroAudienceCta|heroSectors/);
  assert.doesNotMatch(hero, /heroPlatformLabel|One living record per asset|record—/);
  assert.doesNotMatch(hero, /handlePlaybackToggle|onPlaybackToggle|playbackId|key=\{playbackId\}/);
  assert.doesNotMatch(hero, /DESKTOP_STORY_QUERY|IntersectionObserver|scrollIntoView|heroScrollTrack/);

  assert.match(feature, /\.heroStory \{[\s\S]*?min-height: 0/);
  assert.match(feature, /\.homeIntro \{[\s\S]*?position: fixed;[\s\S]*?100dvh/);
  assert.match(feature, /\.homeIntro\[data-phase='exiting'\] \.homeIntroCurtain \{[\s\S]*?translate3d\(0, -100%, 0\)/);
  assert.match(feature, /\.heroSection\[data-intro-phase='visible'\] \.heroGrid \{[\s\S]*?opacity: 0/);
  assert.match(feature, /\.heroSticky \{[\s\S]*?position: relative;[\s\S]*?height: auto/);
  assert.doesNotMatch(feature, /position: sticky|340svh|scroll-snap/);
  assert.match(feature, /\.heroStory \.heroMedia \.shell \{[\s\S]*?width: min\(calc\(100% - 3rem\), 100rem\)/);
  assert.match(feature, /\.heroStory \.heroGrid \{[\s\S]*?grid-template-columns: minmax\(31rem, 37rem\) minmax\(39rem, 49\.5rem\)/);
  assert.match(feature, /\.heroStory \.heroCopy \{[\s\S]*?clamp\(0px, calc\(\(100vw - 1288px\) \/ 2\), 180px\)[\s\S]*?-1\.75rem/);
  assert.match(feature, /@media \(min-width: 1361px\)[\s\S]*?\.heroStory \.heroTitleLine:last-child \{[\s\S]*?font-size: 0\.9em;[\s\S]*?scaleX\(0\.93\)/);
  assert.doesNotMatch(feature, /\.heroPlatformLabel|\.assetPlaybackControl|\.assetStoryControls/);
  assert.match(feature, /\.heroStory \.assetActiveQuestion \{[\s\S]*?top: -4\.25rem/);
  assert.match(feature, /@media \(min-width: 1361px\) and \(max-width: 1479px\)[\s\S]*?\.heroStory \.assetPreviewActions \{[\s\S]*?display: grid/);

  assert.match(feature, /@media \(min-width: 1181px\) and \(max-width: 1240px\)[\s\S]*?\.heroStory \.heroCopy \{[\s\S]*?transform: translate\(8px, -1\.75rem\)/);
  assert.match(feature, /@media \(min-width: 1181px\) and \(max-width: 1360px\)[\s\S]*?\.heroStory \.heroGrid \{[\s\S]*?grid-template-columns: minmax\(27rem, 31rem\) minmax\(34rem, 44rem\)/);
  assert.match(feature, /@media \(min-width: 1181px\) and \(max-width: 1360px\)[\s\S]*?\.heroStory \.heroTitleLine:last-child \{[\s\S]*?font-size: 0\.84em;[\s\S]*?scaleX\(0\.88\)/);
  assert.match(feature, /@media \(max-width: 1180px\)[\s\S]*?\.heroStory \.heroMedia \{[\s\S]*?min-height: 0/);
  assert.match(feature, /@media \(max-width: 1180px\)[\s\S]*?\.heroStory \.heroGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)[\s\S]*?\.heroStory \.heroCopy \{[\s\S]*?transform: none/);
  assert.match(feature, /@media \(max-width: 760px\)[\s\S]*?\.heroStory \.heroActions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(feature, /@media \(max-width: 760px\)[\s\S]*?\.homeIntroTitle \{[\s\S]*?12vw/);
  assert.match(feature, /@media \(max-width: 760px\)[\s\S]*?\.heroStory \.assetQuestionGroup \{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(feature, /@media \(max-width: 760px\)[\s\S]*?\.heroStory \.assetPreviewCard \{[\s\S]*?position: relative;[\s\S]*?order: 1/);
  assert.match(feature, /@media \(max-width: 760px\)[\s\S]*?\.heroStory \.assetPreviewCard \{[\s\S]*?height: clamp\(22rem, 64vw, 28rem\)/);
  assert.match(feature, /@media \(max-width: 640px\)[\s\S]*?\.heroStory \.heroActions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(feature, /@media \(max-width: 640px\)[\s\S]*?\.heroStory \.assetQuestionGroup \{[\s\S]*?grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(feature, /@media \(max-width: 640px\)[\s\S]*?\.heroStory \.assetPreviewCard,[\s\S]*?min-height: clamp\(24rem, 112vw, 29rem\)/);
  assert.match(home, /@media \(max-width: 640px\)[\s\S]*?\.roleGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);

  assert.match(home, /\.assetQuestion:focus-visible \{[\s\S]*?outline: 3px solid/);
  assert.match(home, /\.primaryCta,[\s\S]*?\.secondaryCta \{[\s\S]*?min-height: 3\.2rem/);
  assert.match(feature, /@keyframes heroPreviewReveal/);
  assert.match(feature, /@keyframes heroProgressFill/);
  assert.match(feature, /@keyframes homeIntroLogoReveal/);
  assert.match(feature, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.homeIntro \{[\s\S]*?display: none/);
  assert.match(feature, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none/);
  assert.match(home, /@media \(forced-colors: active\)/);
});

test('asset register has deterministic toolbar, card-action and modal device states', async () => {
  const register = await read('app/asset-register/page.module.css');

  assert.match(register, /Responsive foundation contract, August 2026/);
  assert.match(register, /@media \(max-width: 1040px\)[\s\S]*?\.page \.toolbarActions \{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(min\(9\.5rem, 100%\), 1fr\)\)/);
  assert.match(register, /@media \(max-width: 900px\)[\s\S]*?\.page \.assetHeader \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) clamp\(9\.25rem, 28vw, 11rem\)/);
  assert.match(register, /@media \(max-width: 900px\)[\s\S]*?\.page \.assetGroupHeader \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) clamp\(9\.25rem, 28vw, 11rem\)/);
  assert.match(register, /@media \(max-width: 900px\)[\s\S]*?\.page \.assetHeaderActions,[\s\S]*?\.page \.assetGroupHeaderActions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(register, /@media \(max-width: 760px\)[\s\S]*?min-height: var\(--tap-target-min, 44px\)/);
  assert.match(register, /@media \(max-width: 560px\)[\s\S]*?\.page \.toolbarActions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(register, /max-height: calc\(100dvh - 1rem\) !important/);
  assert.match(register, /overscroll-behavior: contain/);
});

test('Owner and Field Manager apps use fluid tablet gutters without adding desktop behavior', async () => {
  const [owner, field] = await Promise.all([
    read('app/owner-app/owner-app.module.css'),
    read('app/field-manager/page.module.css'),
  ]);

  assert.match(owner, /@media \(min-width: 600px\) and \(max-width: 960px\)[\s\S]*?--owner-page-gutter: clamp\(32px, 6vw, 48px\)/);
  assert.match(owner, /\.assetsHeaderPair \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(owner, /\.managerAssetList,[\s\S]*?\.notificationList \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);

  assert.match(field, /@media \(min-width: 600px\) and \(max-width: 960px\)[\s\S]*?--field-page-gutter: clamp\(32px, 6vw, 48px\)/);
  assert.match(field, /\.homeActionGrid,[\s\S]*?\.overviewList \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(field, /Responsive field manager desktop/);
});

test('account access labels remain single-line but cannot overflow narrow tiles', async () => {
  const access = await read('app/account/app-access-management.module.css');

  assert.match(access, /\.launcherIntro p \{[\s\S]*?white-space: nowrap;[\s\S]*?overflow: hidden;[\s\S]*?text-overflow: ellipsis/);
  assert.match(access, /\.actionCopy small \{[\s\S]*?white-space: nowrap;[\s\S]*?overflow: hidden;[\s\S]*?text-overflow: ellipsis/);
  assert.match(access, /@media \(max-width: 640px\)[\s\S]*?\.actionCopy strong \{[\s\S]*?white-space: nowrap/);
});
