import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage presents the five-question living Asset Register hero and reveals role choice on request', async () => {
  const [page, preview, roleSelector, styles, auth] = await Promise.all([
    read('app/page.tsx'),
    read('app/home-asset-preview.tsx'),
    read('app/home-role-selector.tsx'),
    read('app/page.module.css'),
    read('app/auth/auth-client.tsx'),
  ]);

  assert.match(page, /Everything you own\./);
  assert.match(page, /One living record\./);
  assert.match(
    page,
    /Know what you have, what it is worth over time, what it costs and what needs[\s\S]*?attention\./,
  );
  assert.match(page, /<AppHeader active="home" brandAlignment="working-column" \/>/);
  assert.match(page, /import HomeAssetPreview from '\.\/home-asset-preview'/);
  assert.match(page, /<HomeAssetPreview \/>/);
  assert.match(page, /import HomeRoleSelector from '\.\/home-role-selector'/);
  assert.match(page, /<HomeRoleSelector \/>/);

  assert.match(page, /href="\/valuation"[\s\S]*?Get Free Estimate/);
  assert.match(page, /<a href="#choose-role" className=\{styles\.secondaryCta\}>[\s\S]*?See How It Works/);
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
  assert.match(preview, /aria-labelledby=\{\`home-asset-question-/);
  assert.match(preview, /aria-label=\{question\.label\}/);
  assert.match(preview, /assetQuestionBubble} aria-hidden="true"/);
  assert.match(preview, /assetQuestionBubble[\s\S]*?question\.icon/);
  assert.doesNotMatch(preview, /styles\.assetQuestionLabel/);
  assert.match(preview, /assetActiveQuestion/);
  assert.match(preview, /QUESTIONS\[activeIndex\]\?\.label \?\? QUESTIONS\[0\]\.label/);
  assert.match(preview, /ArrowRight[\s\S]*?ArrowDown/);
  assert.match(preview, /ArrowLeft[\s\S]*?ArrowUp/);
  assert.match(preview, /event\.key === 'Home'/);
  assert.match(preview, /event\.key === 'End'/);
  assert.match(preview, /useState<QuestionKey>\('have'\)/);
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
  assert.match(preview, /alt="White Toyota Hilux single-cab work vehicle in a farm equipment yard"/);
  assert.doesNotMatch(preview, /assetDocumentsPanel|assetDocumentAction|0 Documents|View documents|\+ Add document/);
  assert.match(preview, /<AssetDetail label="Year" value="2023" \/>/);
  assert.match(preview, /<AssetDetail label="Licensed" value="✓" status \/>/);

  // What is it worth? — the final estimate page.
  assert.match(preview, /Aim4price estimate/);
  assert.match(preview, /Confidence: High/);
  assert.match(preview, /R 239 454/);
  assert.match(preview, /VAT excluded[\s\S]*?VAT included/);
  assert.match(preview, /Estimate shown with VAT included\./);
  assert.match(preview, /Create Ad/);
  assert.match(preview, /Save to Asset Register/);
  assert.match(preview, /Download PDF/);

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
    'Dispose or remove asset',
  ]) {
    assert.match(preview, new RegExp(action));
  }

  // What does it cost me? — Fuel and ownership report choices.
  assert.match(preview, /Download maintenance report/);
  assert.match(preview, /Download fuel report/);
  assert.match(preview, /Download depreciation log/);
  assert.match(preview, /Download cost of ownership report/);

  // What needs attention? — the real open-issue presentation.
  assert.match(preview, /2024 Landini Super 110 \+ Front Loader/);
  assert.match(preview, /Open issue reported/);
  assert.match(preview, /Lisensie disk het verval 2025/);
  assert.match(preview, /Sitplek kort aandag/);
  assert.match(preview, /By Gerald · 29 Aug 2026/);

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
  assert.ok(heroImages.every(({ size }) => size > 1_000 && size < 150_000));

  const livingHeroStyles = styles.slice(
    styles.indexOf('/* === Living Asset Record homepage hero, September 2026 === */'),
  );
  const refinementStyles = styles.slice(
    styles.lastIndexOf('/* Five-question hero refinement'),
  );

  assert.match(livingHeroStyles, /\.heroMedia \.shell \{[\s\S]*?100rem/);
  assert.match(livingHeroStyles, /\.heroGrid \{[\s\S]*?grid-template-columns: minmax\(30rem, 36rem\) minmax\(43\.5rem, 49\.5rem\)[\s\S]*?gap: clamp\(5rem, 6vw, 7rem\)/);
  assert.match(livingHeroStyles, /\.heroCopy \{[\s\S]*?width: min\(100%, 38rem\)[\s\S]*?transform: translateY\(0\.9rem\)/);
  assert.match(livingHeroStyles, /\.assetHeroStage \{[\s\S]*?width: min\(100%, 49\.5rem\)[\s\S]*?aspect-ratio: 1000 \/ 650[\s\S]*?justify-self: center/);
  assert.match(livingHeroStyles, /\.assetQuestionGroup \{[\s\S]*?top: 0;[\s\S]*?right: 0;[\s\S]*?bottom: 4\.2rem;[\s\S]*?width: 4\.5rem;[\s\S]*?grid-template-rows: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(livingHeroStyles, /\.assetQuestion \{[\s\S]*?--question-size: 3\.05rem[\s\S]*?min-height: var\(--tap-target-min, 44px\)/);
  assert.match(livingHeroStyles, /\.assetQuestionActive \{[\s\S]*?--question-size: 3\.35rem/);
  assert.doesNotMatch(livingHeroStyles, /\.assetQuestionLabel|\.assetConnectors|\.assetConnectorActive/);
  assert.match(livingHeroStyles, /\.assetPreviewCard \{[\s\S]*?top: 0;[\s\S]*?right: 4\.75rem;[\s\S]*?bottom: 4\.2rem;[\s\S]*?left: 6rem/);
  assert.match(livingHeroStyles, /\.assetActiveQuestion \{[\s\S]*?right: 4\.75rem;[\s\S]*?bottom: 0;[\s\S]*?left: 6rem/);
  assert.match(livingHeroStyles, /@keyframes assetPreviewReveal/);
  assert.match(livingHeroStyles, /\.worthPreview/);
  assert.match(livingHeroStyles, /\.manageGrid/);
  assert.match(livingHeroStyles, /\.reportList/);
  assert.match(livingHeroStyles, /\.attentionPreview/);
  assert.doesNotMatch(livingHeroStyles, /\.assetDocumentsPanel|\.assetDocumentAction/);

  assert.match(refinementStyles, /@media \(min-width: 1361px\)[\s\S]*?\.assetHeroStage \{[\s\S]*?transform: none/);
  assert.match(refinementStyles, /@media \(min-width: 1181px\) and \(max-width: 1600px\)[\s\S]*?width: min\(calc\(100% - 4rem\), 84rem\)/);
  assert.match(refinementStyles, /@media \(max-width: 1180px\)[\s\S]*?\.assetHeroStage \{[\s\S]*?justify-self: center/);
  assert.match(refinementStyles, /@media \(max-width: 760px\)[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(refinementStyles, /@media \(max-width: 760px\)[\s\S]*?\.assetQuestionGroup \{[\s\S]*?order: 2/);
  assert.match(refinementStyles, /@media \(max-width: 760px\)[\s\S]*?\.assetPreviewCard \{[\s\S]*?order: 1/);
  assert.match(refinementStyles, /@media \(max-width: 760px\)[\s\S]*?\.assetActiveQuestion \{[\s\S]*?order: 3/);
  assert.match(refinementStyles, /@media \(max-width: 640px\)[\s\S]*?grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(refinementStyles, /@media \(max-width: 640px\)[\s\S]*?\.assetQuestion:nth-child\(4\) \{[\s\S]*?grid-column: 2 \/ span 2/);
  assert.match(refinementStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.assetPreviewState \{[\s\S]*?animation: none/);
  assert.match(refinementStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.assetQuestion:hover \.assetQuestionBubble \{[\s\S]*?transform: none/);
  assert.match(refinementStyles, /@media \(forced-colors: active\)[\s\S]*?\.assetQuestionBubble/);
  assert.match(styles, /\.assetPreviewActions \{[\s\S]*?pointer-events: none/);
});
