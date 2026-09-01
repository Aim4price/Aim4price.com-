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
  assert.match(preview, /assetActiveQuestionAccent/);
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
  assert.match(preview, /function WorthPreview\(\)[\s\S]*?2023 Toyota Hilux Single Cab/);
  assert.match(preview, /function WorthPreview\(\)[\s\S]*?R 237 150/);
  assert.doesNotMatch(preview, /R 239 454/);
  assert.match(preview, /VAT excluded[\s\S]*?VAT included/);
  assert.match(preview, /Estimate shown with VAT excluded\./);
  assert.match(preview, /worthUpdated[\s\S]*?worthVatToggle/);
  assert.match(preview, /Asset Valuation Report preview/);
  assert.match(preview, /Miniature Asset Valuation Report for the 2023 Toyota Hilux Single Cab/);
  assert.match(preview, /src="\/brand\/aim4price-mark-black\.png"/);
  assert.match(preview, /width=\{660\}[\s\S]*?height=\{515\}[\s\S]*?className=\{styles\.worthReportLogo\}/);
  assert.doesNotMatch(preview, /worthReportLogo\}>A4<\/span>/);
  assert.match(preview, /Asset Details/);
  assert.match(preview, /Record Summary/);
  assert.match(preview, /Client \/ Asset Owner/);
  assert.match(preview, /Aim4price demo owner/);
  assert.match(preview, /\/brand\/home-asset-hilux-thumb-side\.webp/);
  assert.match(preview, /\/brand\/home-asset-hilux-thumb-rear\.webp/);
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
  assert.ok(heroImages.every(({ size }) => size > 1_000 && size < 150_000));

  const livingHeroStyles = styles.slice(
    styles.indexOf('/* === Living Asset Record homepage hero, September 2026 === */'),
  );
  const refinementStyles = styles.slice(
    styles.lastIndexOf('/* Five-question hero refinement'),
  );

  assert.match(livingHeroStyles, /\.heroMedia \.shell \{[\s\S]*?100rem/);
  assert.match(livingHeroStyles, /\.heroGrid \{[\s\S]*?grid-template-columns: minmax\(30rem, 36rem\) minmax\(43\.5rem, 49\.5rem\)[\s\S]*?align-content: center;[\s\S]*?align-items: start;[\s\S]*?gap: clamp\(5rem, 6vw, 7rem\)/);
  assert.match(livingHeroStyles, /\.heroCopy \{[\s\S]*?width: min\(100%, 38rem\)[\s\S]*?align-self: start;[\s\S]*?transform: none/);
  assert.match(livingHeroStyles, /\.assetHeroStage \{[\s\S]*?width: min\(100%, 49\.5rem\)[\s\S]*?aspect-ratio: 1000 \/ 650[\s\S]*?justify-self: center;[\s\S]*?align-self: start/);
  assert.doesNotMatch(livingHeroStyles, /\.assetHeroStage\[data-active-question='worth'\]/);
  assert.match(livingHeroStyles, /\.assetQuestionGroup \{[\s\S]*?top: 0;[\s\S]*?right: 0;[\s\S]*?bottom: 4\.2rem;[\s\S]*?width: 4\.5rem;[\s\S]*?grid-template-rows: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(livingHeroStyles, /\.assetQuestion \{[\s\S]*?--question-size: 3\.05rem[\s\S]*?min-height: var\(--tap-target-min, 44px\)/);
  assert.match(livingHeroStyles, /\.assetQuestionActive \{[\s\S]*?--question-size: 3\.35rem/);
  assert.doesNotMatch(livingHeroStyles, /\.assetQuestionLabel|\.assetConnectors|\.assetConnectorActive/);
  assert.match(livingHeroStyles, /\.assetPreviewCard \{[\s\S]*?top: 0;[\s\S]*?right: 4\.75rem;[\s\S]*?bottom: 4\.2rem;[\s\S]*?left: 6rem/);
  assert.match(livingHeroStyles, /\.assetActiveQuestion \{[\s\S]*?right: 4\.75rem;[\s\S]*?bottom: 0;[\s\S]*?left: 6rem/);
  assert.match(livingHeroStyles, /\.assetActiveQuestionMain \{[\s\S]*?font-size: 1\.08rem/);
  assert.match(livingHeroStyles, /\.assetActiveQuestionMain svg \{[\s\S]*?width: 1\.55rem/);
  assert.match(livingHeroStyles, /\.assetActiveQuestionAccent \{[\s\S]*?width: 2\.5rem[\s\S]*?height: 0\.18rem/);
  assert.match(livingHeroStyles, /@keyframes assetPreviewReveal/);
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

  assert.match(refinementStyles, /@media \(min-width: 1361px\)[\s\S]*?\.assetHeroStage \{[\s\S]*?transform: none/);
  assert.match(refinementStyles, /@media \(min-width: 1181px\) and \(max-width: 1600px\)[\s\S]*?width: min\(calc\(100% - 4rem\), 84rem\)/);
  assert.match(refinementStyles, /@media \(max-width: 1180px\)[\s\S]*?\.assetHeroStage \{[\s\S]*?justify-self: center/);
  assert.match(refinementStyles, /@media \(max-width: 760px\)[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(refinementStyles, /@media \(max-width: 760px\)[\s\S]*?\.assetQuestionGroup \{[\s\S]*?order: 2/);
  assert.match(refinementStyles, /@media \(max-width: 760px\)[\s\S]*?\.assetPreviewCard \{[\s\S]*?order: 1/);
  assert.match(refinementStyles, /@media \(max-width: 760px\)[\s\S]*?\.assetActiveQuestion \{[\s\S]*?order: 3/);
  assert.match(refinementStyles, /@media \(max-width: 640px\)[\s\S]*?grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(refinementStyles, /@media \(max-width: 640px\)[\s\S]*?\.assetQuestion:nth-child\(4\) \{[\s\S]*?grid-column: 2 \/ span 2/);
  assert.match(refinementStyles, /@media \(max-width: 640px\)[\s\S]*?\.worthReportPreview,[\s\S]*?\.worthActions \{[\s\S]*?display: none/);
  assert.doesNotMatch(refinementStyles, /\.serviceCard \{[\s\S]*?display: none/);
  assert.match(refinementStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.assetPreviewState \{[\s\S]*?animation: none/);
  assert.match(refinementStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.assetQuestion:hover \.assetQuestionBubble \{[\s\S]*?transform: none/);
  assert.match(refinementStyles, /@media \(forced-colors: active\)[\s\S]*?\.assetQuestionBubble/);
  assert.match(styles, /\.assetPreviewActions \{[\s\S]*?pointer-events: none/);
});
