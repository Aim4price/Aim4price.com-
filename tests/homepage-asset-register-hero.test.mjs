import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage presents a fixed feature-led hero and reveals role choice on request', async () => {
  const [page, hero, preview, roleSelector, styles, auth] = await Promise.all([
    read('app/page.tsx'),
    read('app/home-hero-experience.tsx'),
    read('app/home-asset-preview.tsx'),
    read('app/home-role-selector.tsx'),
    read('app/page.module.css'),
    read('app/auth/auth-client.tsx'),
  ]);

  assert.match(page, /<AppHeader active="home" brandAlignment="working-column" \/>/);
  assert.match(page, /import HomeHeroExperience from '\.\/home-hero-experience'/);
  assert.match(page, /<HomeHeroExperience \/>/);
  assert.doesNotMatch(page, /import HomeAssetPreview/);
  assert.match(page, /import HomeRoleSelector from '\.\/home-role-selector'/);
  assert.match(page, /<HomeRoleSelector \/>/);
  assert.ok(page.indexOf('<HomeHeroExperience />') < page.indexOf('<HomeRoleSelector />'));

  const heroStages = hero.slice(
    hero.indexOf('export const HERO_STAGES'),
    hero.indexOf('export default function HomeHeroExperience'),
  );
  assert.deepEqual(
    [...heroStages.matchAll(/^\s+'([^']+)',?$/gm)].map((match) => match[1]),
    ['have', 'worth', 'cost', 'manage', 'attention'],
  );

  assert.match(hero, /^'use client';/);
  assert.match(hero, /One living record per asset/);
  assert.match(hero, /Know what you have\./);
  assert.match(hero, /Know what it’s worth\./);
  assert.match(hero, /Know what it costs\./);
  assert.match(hero, /every important asset one living digital record/);
  assert.match(hero, /indicative value/);
  assert.match(hero, /documents, maintenance, fuel, costs and[\s\S]*?history throughout its working life/);

  assert.match(hero, /className=\{styles\.primaryCta\}[\s\S]*?onClick=\{handleDemoAction\}[\s\S]*?Show Next Feature[\s\S]*?Pause Animation[\s\S]*?See Aim4price in Action/);
  assert.match(hero, /<Link href="\/valuation" className=\{styles\.secondaryCta\}>[\s\S]*?Get a Free Estimate/);
  assert.match(hero, /<a href="#choose-role" className=\{styles\.heroAudienceCta\}>[\s\S]*?Choose how you’ll use Aim4price/);
  assert.match(hero, /useState<QuestionKey>\('have'\)/);
  assert.match(hero, /useState\(false\)/);
  assert.match(hero, /useRef\(false\)/);
  assert.match(hero, /data-active-question=\{activeQuestion\}/);
  assert.match(hero, /data-autoplay=\{isAutoplaying \? 'true' : 'false'\}/);
  assert.match(hero, /<HomeAssetPreview[\s\S]*?activeQuestion=\{activeQuestion\}[\s\S]*?onQuestionChange=\{handleQuestionChange\}/);

  assert.match(hero, /HERO_AUTOPLAY_DELAY_MS = 1000/);
  assert.match(hero, /HERO_STAGE_DURATION_MS = 2800/);
  assert.match(hero, /window\.matchMedia\(REDUCED_MOTION_QUERY\)/);
  assert.match(hero, /const shouldAutoplay = !reducedMotionMedia\.matches/);
  assert.match(hero, /reducedMotionMedia\.addEventListener\('change', syncMotionPreference\)/);
  assert.match(hero, /reducedMotionMedia\.removeEventListener\('change', syncMotionPreference\)/);
  assert.match(hero, /window\.setTimeout\([\s\S]*?HERO_AUTOPLAY_DELAY_MS/);
  assert.match(hero, /window\.setTimeout\([\s\S]*?HERO_STAGE_DURATION_MS/);
  assert.match(hero, /HERO_STAGES\.indexOf\(activeQuestion\)/);
  assert.match(hero, /setActiveQuestion\(HERO_STAGES\[activeIndex \+ 1\]!\)/);
  assert.match(hero, /activeIndex >= HERO_STAGES\.length - 1[\s\S]*?setIsAutoplaying\(false\)/);
  assert.match(hero, /window\.clearTimeout\(startTimer\)/);
  assert.match(hero, /window\.clearTimeout\(stageTimer\)/);
  assert.match(hero, /document\.addEventListener\('visibilitychange', pauseWhenHidden\)/);
  assert.match(hero, /document\.removeEventListener\('visibilitychange', pauseWhenHidden\)/);

  assert.match(hero, /const handleQuestionChange[\s\S]*?hasAutoStarted\.current = true;[\s\S]*?setIsAutoplaying\(false\);[\s\S]*?setActiveQuestion\(question\)/);
  assert.match(hero, /const handleDemoAction[\s\S]*?if \(isAutoplaying\)[\s\S]*?setIsAutoplaying\(false\)/);
  assert.match(hero, /if \(!canAutoplay\)[\s\S]*?nextIndex[\s\S]*?setActiveQuestion\(HERO_STAGES\[nextIndex\]!\)/);
  assert.match(hero, /setActiveQuestion\('have'\);[\s\S]*?setIsAutoplaying\(true\)/);
  assert.match(hero, /const handlePreviewInteraction[\s\S]*?setIsAutoplaying\(false\)/);
  assert.match(hero, /<HomeAssetPreview[\s\S]*?key=\{playbackId\}[\s\S]*?onInteraction=\{handlePreviewInteraction\}/);
  assert.doesNotMatch(hero, /IntersectionObserver|scrollIntoView|heroScrollTrack|heroScrollStep|DESKTOP_STORY_QUERY/);
  assert.doesNotMatch(hero, /addEventListener\(['"](?:wheel|touchmove)|preventDefault|scroll-snap|setInterval/);

  assert.doesNotMatch(page, /<section[\s\S]*?id="choose-role"/);
  assert.match(roleSelector, /^'use client';/);
  assert.match(roleSelector, /useState\(false\)/);
  assert.match(roleSelector, /window\.location\.hash === ROLE_SECTION_HASH/);
  assert.match(roleSelector, /addEventListener\('hashchange', syncVisibilityWithHash\)/);
  assert.match(roleSelector, /removeEventListener\('hashchange', syncVisibilityWithHash\)/);
  assert.match(roleSelector, /if \(!isVisible\) \{[\s\S]*?return null;/);
  assert.match(roleSelector, /id="choose-role-title"[\s\S]*?Which best describes you\?/);
  assert.match(roleSelector, /I own or manage assets/);
  assert.match(roleSelector, /I sell, service or support assets/);
  assert.match(roleSelector, /href="\/auth\?accountType=owner#signup"/);
  assert.match(roleSelector, /href="\/auth\?accountType=dealer#signup"/);
  assert.match(roleSelector, /scrollIntoView\(/);
  assert.match(roleSelector, /behavior: 'auto'/);
  assert.doesNotMatch(roleSelector, /behavior: 'smooth'/);
  assert.match(roleSelector, /focus\(\{ preventScroll: true \}\)/);
  assert.match(auth, /accountType === "owner" \|\| accountType === "dealer"/);

  assert.deepEqual(
    [...preview.matchAll(/key: '([^']+)'/g)].map((match) => match[1]),
    ['have', 'worth', 'cost', 'manage', 'attention'],
  );
  assert.deepEqual(
    [...preview.matchAll(/label: '([^']+)'/g)].map((match) => match[1]),
    [
      'Know what you have',
      'Know what it’s worth',
      'Know what it costs',
      'Manage its working life',
      'See what needs attention',
    ],
  );

  assert.match(preview, /role="tablist"[\s\S]*?aria-label="Explore the Aim4price asset record"/);
  assert.doesNotMatch(preview, /aria-orientation=/);
  assert.match(preview, /role="tab"/);
  assert.match(preview, /aria-selected=\{isActive\}/);
  assert.match(preview, /aria-controls="home-asset-preview"/);
  assert.match(preview, /tabIndex=\{isActive \? 0 : -1\}/);
  assert.match(preview, /role="tabpanel"/);
  assert.match(preview, /tabIndex=\{0\}/);
  assert.match(preview, /className=\{styles\.assetHeroStage\}[\s\S]*?data-active-question=\{activeQuestion\}/);
  assert.match(preview, /aria-labelledby=\{\`home-asset-question-/);
  assert.match(preview, /aria-label=\{question\.label\}/);
  assert.match(preview, /assetQuestionBubble} aria-hidden="true"/);
  assert.match(preview, /assetQuestionBubble[\s\S]*?question\.icon/);
  assert.doesNotMatch(preview, /styles\.assetQuestionLabel/);
  assert.match(preview, /assetActiveQuestion/);
  assert.match(preview, /assetActiveQuestionMain/);
  assert.match(preview, /QUESTIONS\[activeIndex\]\?\.icon \?\? QUESTIONS\[0\]\.icon/);
  assert.match(preview, /QUESTIONS\[activeIndex\]\?\.label \?\? QUESTIONS\[0\]\.label/);
  assert.match(preview, /assetStoryProgress/);
  assert.match(preview, /assetStoryProgressActive/);
  assert.doesNotMatch(preview, /assetScrollCue|m7 9\.5 5 5 5-5/);
  assert.doesNotMatch(preview, /assetActiveQuestionAccent/);
  assert.match(preview, /ArrowRight[\s\S]*?ArrowDown/);
  assert.match(preview, /ArrowLeft[\s\S]*?ArrowUp/);
  assert.match(preview, /event\.key === 'Home'/);
  assert.match(preview, /event\.key === 'End'/);
  assert.match(preview, /type HomeAssetPreviewProps = \{[\s\S]*?activeQuestion: QuestionKey;[\s\S]*?onQuestionChange: \(question: QuestionKey, index: number\) => void;/);
  assert.match(preview, /onInteraction\?: \(\) => void/);
  assert.match(preview, /export default function HomeAssetPreview\(\{[\s\S]*?activeQuestion,[\s\S]*?onQuestionChange,/);
  assert.match(preview, /onQuestionChange\(question\.key, index\)/);
  assert.match(preview, /onPointerEnter=\{onInteraction\}/);
  assert.match(preview, /onFocusCapture=\{onInteraction\}/);
  assert.doesNotMatch(preview, /useState<QuestionKey>/);
  assert.doesNotMatch(preview, /setTimeout|setInterval|QUESTION_ROTATION|autoAdvance/);

  assert.match(preview, /switch \(activeQuestion\)/);
  assert.match(preview, /case 'worth':[\s\S]*?<WorthPreview \/>/);
  assert.match(preview, /case 'manage':[\s\S]*?<ManagePreview \/>/);
  assert.match(preview, /case 'cost':[\s\S]*?<CostPreview \/>/);
  assert.match(preview, /case 'attention':[\s\S]*?<AttentionPreview \/>/);
  assert.match(preview, /case 'have':[\s\S]*?<AssetCardPreview \/>/);

  // What do you have? — the approved Asset Register card, with the document column removed.
  assert.match(preview, /2023 Toyota Hilux Single Cab/);
  assert.match(preview, /R 237 150/);
  assert.match(preview, /R 450 000/);
  assert.match(preview, /113 677 km/);
  assert.match(preview, /\/brand\/home-asset-hilux-listing\.webp/);
  assert.match(preview, /alt="Left-side view of the white Toyota Hilux single-cab work vehicle"/);
  assert.match(preview, /width=\{1280\}[\s\S]*?height=\{960\}/);
  assert.doesNotMatch(preview, /assetDocumentsPanel|assetDocumentAction|0 Documents|View documents|\+ Add document/);
  assert.match(preview, /<AssetDetail label="Year" value="2023" \/>/);
  assert.match(preview, /<AssetDetail label="Licensed" value="✓" status \/>/);

  // What is it worth? — the final estimate page.
  const worthPreview = preview.slice(
    preview.indexOf('function WorthPreview()'),
    preview.indexOf('function ManagePreview()'),
  );
  assert.doesNotMatch(worthPreview, /Aim4price estimate|Confidence: High|Updated 01 Sept 2026/);
  assert.match(worthPreview, /2023 Toyota Hilux Single Cab/);
  assert.match(worthPreview, /R 237 150/);
  assert.doesNotMatch(worthPreview, /R 239 454/);
  assert.match(worthPreview, /VAT excluded[\s\S]*?VAT included/);
  assert.match(worthPreview, /Estimate shown with VAT excluded\./);
  assert.match(worthPreview, /<MiniFact label="Replacement" value="R 450 000 excl\. VAT" \/>/);
  assert.doesNotMatch(worthPreview, /label="Replacement price"/);
  assert.match(worthPreview, /Asset Valuation Report preview/);
  assert.match(worthPreview, /Miniature Asset Valuation Report for the 2023 Toyota Hilux Single Cab/);
  assert.match(worthPreview, /src="\/brand\/aim4price-mark-black\.png"/);
  assert.match(worthPreview, /width=\{660\}[\s\S]*?height=\{515\}[\s\S]*?className=\{styles\.worthReportLogo\}/);
  assert.doesNotMatch(worthPreview, /worthReportLogo\}>A4<\/span>/);
  assert.match(worthPreview, /Asset Details/);
  assert.match(worthPreview, /Record Summary/);
  assert.match(worthPreview, /Client \/ Asset Owner/);
  assert.match(worthPreview, /Aim4price demo owner/);
  assert.match(worthPreview, /\/brand\/home-asset-hilux-thumb-side\.webp/);
  assert.match(worthPreview, /\/brand\/home-asset-hilux-thumb-rear\.webp/);
  assert.match(worthPreview, /Create Ad/);
  assert.match(worthPreview, /Save to Asset Register/);
  assert.match(worthPreview, /Download PDF/);

  // How can I manage it? — the same owner command set as the Asset Register.
  for (const action of [
    'Update asset',
    'Reports',
    'Add cost',
    'Add fuel',
    'Maintenance',
    'Asset map',
    'QR code',
    'Marketplace',
    'Remove asset',
  ]) {
    assert.match(preview, new RegExp(action));
  }
  assert.match(
    preview,
    /function ManagePreview\(\)[\s\S]*?Year Model: 2023 · Usage: 113 677 km · Condition: Good/,
  );
  assert.doesNotMatch(preview, /function ManagePreview\(\)[\s\S]*?Manage asset/);
  assert.doesNotMatch(preview, /function ManagePreview\(\)[\s\S]*?Choose what you want to do with this asset\./);
  assert.doesNotMatch(preview, /Dispose or remove asset/);

  // What does it cost me? — Fuel and ownership report choices.
  const costPreview = preview.slice(
    preview.indexOf('function CostPreview()'),
    preview.indexOf('function AttentionPreview()'),
  );
  assert.match(costPreview, /<h2>2023 Toyota Hilux Single Cab<\/h2>/);
  assert.match(costPreview, /Year Model: 2023 · Usage: 113 677 km · Condition: Good/);
  assert.doesNotMatch(costPreview, /previewEyebrow/);
  assert.doesNotMatch(costPreview, /See what the asset costs across fuel, maintenance and ownership\./);
  assert.doesNotMatch(costPreview, /reportRowHighlighted/);
  assert.match(costPreview, /Download maintenance report/);
  assert.match(costPreview, /Download fuel report/);
  assert.match(costPreview, /Download depreciation log/);
  assert.match(costPreview, /Download cost of ownership report/);

  // What needs attention? — the real open-issue presentation.
  const attentionPreview = preview.slice(
    preview.indexOf('function AttentionPreview()'),
    preview.indexOf('function MiniFact('),
  );
  assert.match(attentionPreview, /<h2>2023 Toyota Hilux Single Cab<\/h2>/);
  assert.match(attentionPreview, /Year Model: 2023 · Usage: 113 677 km · Condition: Good/);
  assert.match(attentionPreview, /R 237 150[\s\S]*?Excl\. VAT/);
  assert.match(attentionPreview, /Aim4price value[\s\S]*?Updated 01 Sept 2026/);
  assert.match(attentionPreview, /Share[\s\S]*?View details[\s\S]*?Manage/);
  assert.match(attentionPreview, /Open issue reported/);
  assert.match(attentionPreview, /Lisensie disk het verval 2025/);
  assert.match(attentionPreview, /Sitplek kort aandag/);
  assert.match(attentionPreview, /Maintenance has been done/);
  assert.match(attentionPreview, /Changed engine oil/);
  assert.match(attentionPreview, /By Gerald · 29 Aug 2026/);
  assert.doesNotMatch(attentionPreview, /2024 Landini Super 110 \+ Front Loader/);
  assert.doesNotMatch(attentionPreview, /20 741 hours|R 446 250/);

  assert.doesNotMatch(preview, /assetConnectors|connectorPath|connectorDots|assetConnectorActive/);
  assert.match(preview, /role="status"/);
  assert.match(preview, /setFeedback\(QUESTION_FEEDBACK\[question\.key\]\)/);
  assert.match(preview, /\{feedback\}/);
  assert.doesNotMatch(preview, /assetActiveQuestion\} aria-live/);
  assert.match(preview, /aria-label=\{status \? \`\$\{label\}: yes\` : undefined\}/);

  const heroImages = await Promise.all(
    [
      'home-asset-hilux-listing.webp',
      'home-asset-hilux-thumb-side.webp',
      'home-asset-hilux-thumb-rear.webp',
      'home-asset-hilux-thumb-alt.webp',
    ].map((filename) => stat(new URL(`../public/brand/${filename}`, import.meta.url))),
  );
  assert.ok(heroImages[0].size > 80_000 && heroImages[0].size < 150_000);
  assert.ok(heroImages.slice(1).every(({ size }) => size > 15_000 && size < 50_000));

  const livingHeroStyles = styles.slice(
    styles.indexOf('/* === Living Asset Record homepage hero, September 2026 === */'),
  );
  const featureHeroStart = styles.indexOf(
    '/* === Feature-led living record homepage hero, September 2026 === */',
  );
  const featureHeroStyles = styles.slice(featureHeroStart);

  assert.ok(featureHeroStart >= 0);
  assert.match(livingHeroStyles, /\.assetPreviewActions \{[\s\S]*?pointer-events: none/);
  assert.doesNotMatch(livingHeroStyles, /\.assetDocumentsPanel|\.assetDocumentAction/);

  assert.match(featureHeroStyles, /\.heroStory \{[\s\S]*?min-height: 0/);
  assert.match(featureHeroStyles, /\.heroSticky \{[\s\S]*?position: relative;[\s\S]*?top: auto;[\s\S]*?height: auto/);
  assert.match(featureHeroStyles, /\.heroScrollTrack,[\s\S]*?\.assetScrollCue \{[\s\S]*?display: none/);
  assert.doesNotMatch(featureHeroStyles, /340svh|position: sticky|grid-template-rows: repeat\(5/);
  assert.doesNotMatch(styles, /Scroll-driven homepage story|Final cascade guard for the scroll-story composition/);

  assert.match(featureHeroStyles, /\.heroStory \.heroMedia \{[\s\S]*?min-height: clamp\(42\.5rem, calc\(100svh - 5\.75rem\), 54rem\)/);
  assert.match(featureHeroStyles, /\.heroStory \.heroMedia::after \{[\s\S]*?radial-gradient\([\s\S]*?pointer-events: none/);
  assert.match(featureHeroStyles, /\.heroStory \.heroMedia \.shell \{[\s\S]*?100rem/);
  assert.match(featureHeroStyles, /\.heroStory \.heroGrid \{[\s\S]*?grid-template-columns: minmax\(31rem, 37rem\) minmax\(39rem, 49\.5rem\)[\s\S]*?align-items: center;[\s\S]*?gap: clamp\(3\.5rem, 5vw, 6rem\)/);
  assert.match(featureHeroStyles, /\.heroStory \.heroCopy \{[\s\S]*?max-width: 37rem;[\s\S]*?align-self: center/);
  assert.match(featureHeroStyles, /\.heroPlatformLabel \{[\s\S]*?text-transform: uppercase/);
  assert.match(featureHeroStyles, /\.heroStory \.heroTitle \{[\s\S]*?font-size: clamp\(3\.15rem, 3\.4vw, 3\.65rem\)/);
  assert.match(featureHeroStyles, /\.heroStory \.heroText \{[\s\S]*?max-width: 34rem;[\s\S]*?line-height: 1\.62/);
  assert.match(featureHeroStyles, /\.heroStory \.primaryCta \{[\s\S]*?width: 14\.4rem;[\s\S]*?cursor: pointer/);
  assert.match(featureHeroStyles, /\.heroAudienceCta \{[\s\S]*?margin-top: 1\.05rem/);

  assert.match(featureHeroStyles, /\.heroStory \.assetHeroStage \{[\s\S]*?width: min\(100%, 49\.5rem\);[\s\S]*?align-self: center/);
  assert.match(featureHeroStyles, /\.heroStory \.assetPreviewCard \{[\s\S]*?right: 4\.85rem;[\s\S]*?left: 6rem;[\s\S]*?box-shadow/);
  assert.match(featureHeroStyles, /\.heroStory \.assetActiveQuestion \{[\s\S]*?top: -4\.25rem;[\s\S]*?bottom: auto/);
  assert.match(featureHeroStyles, /\.assetStoryProgress > \.assetStoryProgressActive \{[\s\S]*?width: 1\.45rem/);

  assert.match(featureHeroStyles, /@keyframes heroPreviewReveal/);
  assert.match(featureHeroStyles, /@keyframes heroProgressFill/);
  assert.match(featureHeroStyles, /\.heroStory \.assetPreviewState \{[\s\S]*?animation: heroPreviewReveal 440ms/);
  assert.match(featureHeroStyles, /\.heroStory \.assetPreviewState \{[\s\S]*?width: 100%;[\s\S]*?flex: 1 1 auto/);
  assert.match(featureHeroStyles, /\.heroSection\[data-autoplay='true'\] \.assetStoryProgress > \.assetStoryProgressActive::after \{[\s\S]*?animation: heroProgressFill 2800ms/);
  assert.match(featureHeroStyles, /@media \(min-width: 1361px\) and \(max-width: 1479px\)[\s\S]*?\.heroStory \.assetPreviewIdentity \{[\s\S]*?width: auto[\s\S]*?\.heroStory \.assetPreviewActions \{[\s\S]*?display: grid/);

  assert.match(featureHeroStyles, /@media \(max-width: 1180px\)[\s\S]*?\.heroStory \.heroGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(featureHeroStyles, /@media \(max-width: 760px\)[\s\S]*?\.heroStory \.heroActions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(featureHeroStyles, /@media \(max-width: 760px\)[\s\S]*?\.heroStory \.assetQuestionGroup \{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);[\s\S]*?order: 2/);
  assert.match(featureHeroStyles, /@media \(max-width: 760px\)[\s\S]*?\.heroStory \.assetPreviewCard \{[\s\S]*?position: relative;[\s\S]*?order: 1/);
  assert.match(featureHeroStyles, /@media \(max-width: 760px\)[\s\S]*?\.heroStory \.assetPreviewCard \{[\s\S]*?height: clamp\(22rem, 64vw, 28rem\)/);
  assert.match(featureHeroStyles, /@media \(max-width: 640px\)[\s\S]*?\.heroStory \.heroActions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(featureHeroStyles, /@media \(max-width: 640px\)[\s\S]*?\.heroStory \.assetQuestionGroup \{[\s\S]*?grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(featureHeroStyles, /@media \(max-width: 640px\)[\s\S]*?\.heroStory \.assetPreviewCard,[\s\S]*?min-height: clamp\(24rem, 112vw, 29rem\)/);
  assert.doesNotMatch(featureHeroStyles, /\.serviceCard \{[^}]*display:\s*none/s);

  assert.match(featureHeroStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.heroStory \.assetPreviewState,[\s\S]*?animation: none/);
  assert.match(featureHeroStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.heroStory \.assetQuestionBubble,[\s\S]*?transition: none/);
  assert.match(featureHeroStyles, /@media \(forced-colors: active\)[\s\S]*?\.assetQuestionBubble/);
});
