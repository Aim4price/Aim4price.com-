import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage presents the five-question living Asset Register hero and reveals role choice on request', async () => {
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
    [...heroStages.matchAll(/key: '([^']+)'/g)].map((match) => match[1]),
    ['have', 'worth', 'manage', 'cost', 'attention'],
  );
  assert.deepEqual(
    [...heroStages.matchAll(/titleLines: \['([^']+)', '([^']+)'\]/g)].map((match) => match.slice(1)),
    [
      ['Everything you own.', 'One living record.'],
      ['Know what it’s worth.', 'At every stage.'],
      ['Manage every asset.', 'From one place.'],
      ['Know what every asset', 'really costs.'],
      ['See what needs attention.', 'Before it costs you.'],
    ],
  );
  assert.deepEqual(
    [...heroStages.matchAll(/description: '([^']+)'/g)].map((match) => match[1]),
    [
      'Know what you have, where it is and whether its record is complete.',
      'Follow its value over time and keep a clear valuation report ready.',
      'Update records, capture costs, schedule maintenance, map, share or sell.',
      'Bring fuel, maintenance, repairs and ownership costs into one clear view.',
      'Spot open issues, expired items and upcoming maintenance early.',
    ],
  );

  assert.match(hero, /^'use client';/);
  assert.match(hero, /href="\/valuation"[\s\S]*?Get Free Estimate/);
  assert.match(hero, /<a href="#choose-role" className=\{styles\.secondaryCta\}>[\s\S]*?See How It Works/);
  assert.match(hero, /useState<QuestionKey>\('have'\)/);
  assert.match(hero, /const activeStage = HERO_STAGES\.find\(\(\{ key \}\) => key === activeQuestion\)/);
  assert.match(hero, /<HomeAssetPreview[\s\S]*?activeQuestion=\{activeQuestion\}[\s\S]*?onQuestionChange=\{handleQuestionChange\}/);
  assert.match(hero, /setActiveQuestion\(question\)[\s\S]*?stepRefs\.current\[index\]\?\.scrollIntoView/);
  assert.match(hero, /behavior: 'auto'/);
  assert.doesNotMatch(hero, /behavior: 'smooth'|prefersReducedMotion|--hero-line-index/);
  assert.match(hero, /if \(!isDesktopStory\) return;/);

  assert.match(hero, /window\.matchMedia\(REDUCED_MOTION_QUERY\)/);
  assert.match(hero, /window\.matchMedia\(DESKTOP_STORY_QUERY\)/);
  assert.match(hero, /desktopStoryMedia\.matches[\s\S]*?!reducedMotionMedia\.matches[\s\S]*?'IntersectionObserver' in window/);
  assert.match(hero, /new IntersectionObserver\(/);
  assert.match(hero, /entry\.isIntersecting \? entry\.intersectionRatio : 0/);
  assert.match(hero, /rootMargin: '-44% 0px -44% 0px'/);
  assert.match(hero, /threshold: \[0, 0\.01, 0\.5, 1\]/);
  assert.match(hero, /observer\.observe\(step\)/);
  assert.match(hero, /return \(\) => observer\.disconnect\(\)/);
  assert.match(hero, /data-hero-stage=\{stage\.key\}/);
  assert.match(hero, /data-active-question=\{activeQuestion\}/);
  assert.doesNotMatch(hero, /addEventListener\(['"](?:wheel|touchmove)/);
  assert.doesNotMatch(hero, /preventDefault|scroll-snap|setTimeout|setInterval|autoAdvance|QUESTION_ROTATION/);

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
    ['have', 'worth', 'manage', 'cost', 'attention'],
  );
  assert.deepEqual(
    [...preview.matchAll(/label: '([^']+)'/g)].map((match) => match[1]),
    [
      'What do you have?',
      'What is it worth?',
      'How can I manage it?',
      'What does it cost me?',
      'What needs attention?',
    ],
  );

  assert.match(preview, /role="tablist"[\s\S]*?aria-label="Explore the Aim4price asset record"/);
  assert.match(preview, /aria-orientation="vertical"/);
  assert.match(preview, /role="tab"/);
  assert.match(preview, /aria-selected=\{isActive\}/);
  assert.match(preview, /aria-controls="home-asset-preview"/);
  assert.match(preview, /tabIndex=\{isActive \? 0 : -1\}/);
  assert.match(preview, /role="tabpanel"/);
  assert.match(preview, /tabIndex=\{0\}/);
  assert.match(preview, /className=\{styles\.assetHeroStage\} data-active-question=\{activeQuestion\}/);
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
  assert.match(preview, /assetScrollCue/);
  assert.match(preview, /<path d="m7 9\.5 5 5 5-5" \/>/);
  assert.doesNotMatch(preview, /assetActiveQuestionAccent/);
  assert.match(preview, /ArrowRight[\s\S]*?ArrowDown/);
  assert.match(preview, /ArrowLeft[\s\S]*?ArrowUp/);
  assert.match(preview, /event\.key === 'Home'/);
  assert.match(preview, /event\.key === 'End'/);
  assert.match(preview, /type HomeAssetPreviewProps = \{[\s\S]*?activeQuestion: QuestionKey;[\s\S]*?onQuestionChange: \(question: QuestionKey, index: number\) => void;/);
  assert.match(preview, /export default function HomeAssetPreview\(\{[\s\S]*?activeQuestion,[\s\S]*?onQuestionChange,/);
  assert.match(preview, /onQuestionChange\(question\.key, index\)/);
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
  assert.match(preview, /hasUserSelected \? QUESTION_FEEDBACK\[activeQuestion\] : ''/);
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
  const storyStart = styles.indexOf('/* === Scroll-driven homepage story, September 2026 === */');
  const followingLegacyBlock = styles.indexOf('/* Five-question hero refinement', storyStart);
  const storyStyles = styles.slice(
    storyStart,
    followingLegacyBlock === -1 ? undefined : followingLegacyBlock,
  );
  const activeQuestionStyles = livingHeroStyles.slice(
    livingHeroStyles.indexOf('.assetActiveQuestion {'),
    livingHeroStyles.indexOf('.assetActiveQuestionMain {'),
  );

  assert.ok(storyStart >= 0);

  assert.match(livingHeroStyles, /\.heroMedia \.shell \{[\s\S]*?100rem/);
  assert.match(livingHeroStyles, /\.heroGrid \{[\s\S]*?grid-template-columns: minmax\(30rem, 36rem\) minmax\(43\.5rem, 49\.5rem\)[\s\S]*?align-content: center;[\s\S]*?align-items: start;[\s\S]*?gap: clamp\(5rem, 6vw, 7rem\)/);
  assert.match(livingHeroStyles, /\.heroCopy \{[\s\S]*?width: min\(100%, 38rem\)[\s\S]*?align-self: start;[\s\S]*?transform: none/);
  assert.match(livingHeroStyles, /\.assetHeroStage \{[\s\S]*?width: min\(100%, 49\.5rem\)[\s\S]*?aspect-ratio: 1000 \/ 650[\s\S]*?justify-self: center;[\s\S]*?align-self: start/);
  assert.doesNotMatch(livingHeroStyles, /\.assetHeroStage\[data-active-question='worth'\]/);
  assert.match(livingHeroStyles, /\.assetQuestionGroup \{[\s\S]*?top: 0;[\s\S]*?right: auto;[\s\S]*?bottom: 4\.2rem;[\s\S]*?left: 0;[\s\S]*?width: 4\.5rem;[\s\S]*?grid-template-rows: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(livingHeroStyles, /\.assetQuestion \{[\s\S]*?--question-size: 3\.05rem[\s\S]*?min-height: var\(--tap-target-min, 44px\)/);
  assert.match(livingHeroStyles, /\.assetQuestionActive \{[\s\S]*?--question-size: 3\.35rem/);
  assert.doesNotMatch(livingHeroStyles, /\.assetQuestionLabel|\.assetConnectors|\.assetConnectorActive/);
  assert.match(livingHeroStyles, /\.assetPreviewCard \{[\s\S]*?top: 0;[\s\S]*?right: 4\.75rem;[\s\S]*?bottom: 4\.2rem;[\s\S]*?left: 6rem/);
  assert.match(livingHeroStyles, /\.assetActiveQuestion \{[\s\S]*?right: 4\.75rem;[\s\S]*?bottom: 0;[\s\S]*?left: 6rem/);
  assert.match(livingHeroStyles, /\.assetActiveQuestionMain \{[\s\S]*?font-size: 1\.08rem/);
  assert.match(livingHeroStyles, /\.assetActiveQuestionMain svg \{[\s\S]*?width: 1\.55rem/);
  assert.doesNotMatch(activeQuestionStyles, /border:|background:|box-shadow:/);
  assert.doesNotMatch(livingHeroStyles, /@keyframes assetPreviewReveal/);
  assert.match(livingHeroStyles, /\.assetPreviewState \{[\s\S]*?animation: none/);
  assert.match(livingHeroStyles, /\.worthPreview \{[\s\S]*?grid-template-columns: minmax\(0, 1\.15fr\) minmax\(0, 1fr\)[\s\S]*?grid-template-rows: minmax\(0, 1fr\) 2\.7rem/);
  assert.match(livingHeroStyles, /\.worthReportPreview \{[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden/);
  assert.match(livingHeroStyles, /\.worthReportPaper \{[\s\S]*?width: auto;[\s\S]*?height: 100%;[\s\S]*?max-width: 100%;[\s\S]*?max-height: 100%;[\s\S]*?aspect-ratio: 0\.65;[\s\S]*?overflow: hidden/);
  assert.match(livingHeroStyles, /\.worthReportHeader \{[\s\S]*?grid-template-columns: 1\.35rem minmax\(0, 1fr\) auto/);
  assert.match(livingHeroStyles, /\.worthReportLogo \{[\s\S]*?display: block;[\s\S]*?width: 1\.35rem;[\s\S]*?height: auto;[\s\S]*?object-fit: contain/);
  assert.match(livingHeroStyles, /\.worthReportBody \{[\s\S]*?min-width: 0;[\s\S]*?min-height: 0/);
  assert.match(livingHeroStyles, /\.worthActions \{[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?grid-template-columns: minmax\(0, 0\.86fr\) minmax\(0, 1\.26fr\) minmax\(0, 0\.98fr\)/);
  assert.match(livingHeroStyles, /\.managePreviewHeader,[\s\S]*?\.costPreviewHeader \{[\s\S]*?padding: 0\.45rem 0\.4rem 0\.78rem/);
  assert.match(livingHeroStyles, /\.manageGrid \{[\s\S]*?gap: 0\.52rem;[\s\S]*?padding-top: 0\.68rem/);
  assert.match(livingHeroStyles, /\.reportRow \{[\s\S]*?background: #ffffff/);
  assert.doesNotMatch(livingHeroStyles, /\.reportRowHighlighted/);
  assert.match(livingHeroStyles, /\.reportList/);
  assert.match(livingHeroStyles, /\.assetHeroStage\[data-active-question='attention'\] \.assetPreviewCard \{[\s\S]*?border-color: rgba\(225, 70, 61, 0\.78\)[\s\S]*?background: linear-gradient/);
  assert.match(livingHeroStyles, /\.attentionBody \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?grid-template-rows: minmax\(0, 0\.85fr\) minmax\(0, 1\.15fr\)/);
  assert.match(livingHeroStyles, /\.serviceCard \{[\s\S]*?color: #ffffff;[\s\S]*?background: linear-gradient\(145deg, #404956, #5c6775\)/);
  assert.doesNotMatch(livingHeroStyles, /\.assetDocumentsPanel|\.assetDocumentAction/);

  // The desktop story uses native scrolling to advance five passive stage markers.
  assert.match(storyStyles, /\.heroStory \{[\s\S]*?min-height: calc\(100svh - 5\.75rem\)/);
  assert.match(storyStyles, /@media \(min-width: 1181px\)[\s\S]*?\.heroStory \{[\s\S]*?min-height: calc\(340svh - 5\.75rem\)/);
  assert.match(storyStyles, /\.heroSticky \{[\s\S]*?position: sticky;[\s\S]*?top: 5\.75rem;[\s\S]*?height: calc\(100svh - 5\.75rem\)/);
  assert.match(storyStyles, /\.heroScrollTrack \{[\s\S]*?display: grid;[\s\S]*?grid-template-rows: repeat\(5, minmax\(0, 1fr\)\);[\s\S]*?pointer-events: none/);
  assert.match(storyStyles, /\.heroSticky \.shell \{[\s\S]*?width: min\(calc\(100% - 4rem\), 84rem\);[\s\S]*?height: 100%/);

  // Copy and card share the same grid start line, while the card never exceeds the approved width.
  assert.match(storyStyles, /\.heroStory \.heroGrid \{[\s\S]*?grid-template-columns: minmax\(0, 5fr\) minmax\(0, 6fr\);[\s\S]*?align-content: center;[\s\S]*?align-items: start;[\s\S]*?gap: 4rem/);
  assert.match(storyStyles, /\.heroStory \.heroCopy \{[\s\S]*?width: min\(100%, 36rem\);[\s\S]*?max-width: 36rem;[\s\S]*?align-self: start;[\s\S]*?transform: none/);
  assert.match(storyStyles, /\.heroStory \.assetHeroStage \{[\s\S]*?width: min\(100%, 44rem\);[\s\S]*?max-width: 44rem;[\s\S]*?aspect-ratio: 1000 \/ 650;[\s\S]*?align-self: start;[\s\S]*?justify-self: center/);
  assert.match(storyStyles, /\.heroStory \.assetQuestionGroup \{[\s\S]*?right: auto;[\s\S]*?left: 0;[\s\S]*?width: 4\.5rem/);
  assert.match(storyStyles, /\.heroStory \.assetPreviewCard \{[\s\S]*?top: 0;[\s\S]*?right: 5\.1rem;[\s\S]*?bottom: 4\.65rem;[\s\S]*?left: 6rem/);
  assert.match(storyStyles, /\.heroStory \.heroTitle \{[\s\S]*?max-width: 36rem;[\s\S]*?font-size: 3\.45rem/);
  assert.doesNotMatch(styles, /\.heroStory \.heroSticky \.shell \{[^}]*\b(?:92|100)rem\b/s);

  // The visible copy and card move together inside the header rails without changing card insets.
  assert.match(styles, /@media \(min-width: 1361px\)[\s\S]*?\.heroStory \.heroCopy,[\s\S]*?\.heroStory \.assetHeroStage \{[\s\S]*?transform: translateX\(3\.25rem\)/);

  // The active question sits subtly above the card and the CTAs follow the copy closely.
  assert.match(styles, /@media \(min-width: 1181px\)[\s\S]*?\.heroStory \.heroCopyState \{[\s\S]*?min-height: 12\.5rem/);
  assert.match(styles, /@media \(min-width: 1181px\)[\s\S]*?\.heroStory \.heroActions \{[\s\S]*?margin-top: 1\.1rem/);
  assert.match(styles, /@media \(min-width: 1181px\)[\s\S]*?\.heroStory \.assetActiveQuestion \{[\s\S]*?top: -4\.25rem;[\s\S]*?bottom: auto/);

  // Card and copy changes are immediate; the hero has no entrance, pulse or smooth-scroll motion.
  assert.doesNotMatch(storyStyles, /@keyframes hero(?:TitleLineReveal|TextReveal|SupportReveal|CardReveal)|@keyframes activeQuestionPulse/);
  assert.deepEqual(
    [...storyStyles.matchAll(/animation:\s*([^;{}]+)/g)]
      .map((match) => match[1].trim())
      .filter((value) => !value.startsWith('none')),
    [],
  );
  assert.match(styles, /\.heroStory \.heroTitleLine,[\s\S]*?\.heroStory \.secondaryCta \{[\s\S]*?animation: none !important;[\s\S]*?transition: none !important/);
  assert.match(styles, /\.heroStory \.assetQuestion:hover \.assetQuestionBubble,[\s\S]*?\.heroStory \.secondaryCta:hover \{[\s\S]*?transform: none/);
  assert.doesNotMatch(storyStyles, /scroll-snap/);

  // The question remains a subtle, unboxed caption with progress dashes and a scroll cue.
  assert.match(storyStyles, /\.assetStoryProgress \{[\s\S]*?display: inline-flex;[\s\S]*?gap: 0\.38rem/);
  assert.match(storyStyles, /\.assetStoryProgress > span \{[\s\S]*?width: 0\.82rem;[\s\S]*?height: 0\.16rem/);
  assert.match(storyStyles, /\.assetStoryProgress > \.assetStoryProgressActive \{[\s\S]*?width: 1\.2rem;[\s\S]*?background: #169d6f/);
  assert.match(storyStyles, /\.assetScrollCue \{[\s\S]*?color: rgba\(13, 91, 67, 0\.55\)/);
  assert.match(storyStyles, /\.assetHeroStage\[data-active-question='attention'\] \.assetScrollCue \{[\s\S]*?opacity: 0/);

  // Tablet and phone layouts return to normal document flow and retain manual bubble controls.
  assert.match(storyStyles, /@media \(max-width: 1180px\)[\s\S]*?\.heroStory \{[\s\S]*?min-height: 0;[\s\S]*?\.heroSticky \{[\s\S]*?position: relative;[\s\S]*?top: auto;[\s\S]*?height: auto/);
  assert.match(storyStyles, /@media \(max-width: 1180px\)[\s\S]*?\.heroStory \.heroGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?align-items: start/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.assetQuestionGroup \{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);[\s\S]*?order: 2/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.assetPreviewCard \{[\s\S]*?order: 1/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.assetActiveQuestion \{[\s\S]*?order: 3/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.assetQuestionGroup \{[\s\S]*?grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.assetQuestion:nth-child\(4\) \{[\s\S]*?grid-column: 2 \/ span 2/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.worthReportPreview,[\s\S]*?\.worthActions \{[\s\S]*?display: none/);
  assert.doesNotMatch(styles, /\.serviceCard \{[^}]*display:\s*none/s);

  // Reduced motion removes the sticky runway and every story animation/transition.
  assert.doesNotMatch(storyStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\bhtml\s*\{/);
  assert.match(storyStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.heroStory \{[\s\S]*?min-height: 0;[\s\S]*?\.heroSticky \{[\s\S]*?position: relative;[\s\S]*?height: auto/);
  assert.match(storyStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.heroScrollTrack \{[\s\S]*?display: none/);
  assert.match(storyStyles, /\.heroCopyState,[\s\S]*?\.assetScrollCue \{[\s\S]*?animation: none !important;[\s\S]*?transition: none !important;[\s\S]*?transform: none !important/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*?\.assetQuestionBubble/);
  assert.match(styles, /\.assetPreviewActions \{[\s\S]*?pointer-events: none/);
});
