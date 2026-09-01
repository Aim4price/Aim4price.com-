import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage presents the living Asset Register hero and reveals the role choice on request', async () => {
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
  assert.match(
    roleSelector,
    /<section[\s\S]*?id="choose-role"[\s\S]*?aria-labelledby="choose-role-title"/,
  );
  assert.match(roleSelector, /id="choose-role-title"[\s\S]*?Which best describes you\?/);
  assert.match(roleSelector, /I own or manage assets/);
  assert.match(roleSelector, /I sell, service or support assets/);
  assert.match(roleSelector, /href="\/auth\?accountType=owner#signup"/);
  assert.match(roleSelector, /href="\/auth\?accountType=dealer#signup"/);
  assert.match(roleSelector, /window\.requestAnimationFrame/);
  assert.match(roleSelector, /window\.cancelAnimationFrame/);
  assert.match(roleSelector, /prefers-reduced-motion: reduce/);
  assert.match(roleSelector, /scrollIntoView\(/);
  assert.match(roleSelector, /focus\(\{ preventScroll: true \}\)/);
  assert.match(roleSelector, /tabIndex=\{-1\}/);
  assert.match(auth, /getSignupAccountTypeFromSearch/);
  assert.match(auth, /accountType === "owner" \|\| accountType === "dealer"/);
  assert.match(auth, /accountSubtype: getDefaultSubtype\(requestedAccountType\)/);

  assert.deepEqual(
    [...preview.matchAll(/label: '([^']+)'/g)].map((match) => match[1]),
    [
      'What do I have?',
      'What is it worth?',
      'What is it costing me?',
      'What needs attention?',
    ],
  );
  assert.equal((preview.match(/type="button"/g) ?? []).length, 1);
  assert.match(preview, /role="group"[\s\S]*?aria-label="Explore the Aim4price asset record"/);
  assert.match(preview, /aria-pressed=\{isActive\}/);
  assert.match(preview, /aria-controls="home-asset-preview"/);
  assert.match(preview, /id="home-asset-preview"/);
  assert.match(preview, /useState<QuestionKey>\('worth'\)/);
  assert.match(preview, /QUESTION_ROTATION_MS = 5000/);
  assert.match(preview, /prefers-reduced-motion: reduce/);
  assert.match(preview, /autoAdvanceCount >= QUESTIONS\.length/);
  assert.match(preview, /hasUserSelected/);
  assert.match(preview, /window\.setTimeout/);
  assert.doesNotMatch(preview, /window\.setInterval/);
  assert.match(preview, /onMouseEnter=[\s\S]*?onMouseLeave=[\s\S]*?onFocusCapture=[\s\S]*?onBlurCapture=/);

  assert.match(preview, /2023 Toyota Hilux Single Cab/);
  assert.match(preview, /R 237 150/);
  assert.match(preview, /R 450 000/);
  assert.match(preview, /113 677 km/);
  assert.match(preview, /\/brand\/home-asset-hilux-listing\.webp/);
  assert.match(preview, /alt="White Toyota Hilux single-cab work vehicle in a farm equipment yard"/);
  assert.doesNotMatch(preview, /registration|serial|CAW 122854/i);
  assert.doesNotMatch(preview, /fetch\(|\/api\/asset-register|asset-register-client/);
  assert.match(preview, /assetPreviewActions} aria-hidden="true"/);
  assert.doesNotMatch(preview, /assetPhotoAction|assetPhotoArrow|assetPhotoCount/);
  assert.match(preview, /assetDocumentsPanel/);
  assert.match(preview, /assetDocumentAction/);
  assert.match(preview, /0 Documents/);
  assert.match(preview, /View documents/);
  assert.match(preview, /activeQuestion === 'cost' \? 'Cost ledger' : '\+ Add document'/);
  assert.match(preview, /Ownership costs/);
  assert.match(preview, /Fuel · Maintenance · Repairs/);
  assert.match(preview, /viewBox="0 0 1000 560"/);
  assert.match(preview, /connectorDots/);
  assert.equal((preview.match(/<circle key=\{index\}/g) ?? []).length, 1);
  assert.match(preview, /assetShareAction[\s\S]*?<svg[\s\S]*?Share/);
  assert.match(preview, /assetDetailsAction[\s\S]*?<svg[\s\S]*?Hide details/);
  assert.match(preview, /assetManageAction[\s\S]*?<svg[\s\S]*?Manage/);
  assert.match(preview, /M12\.22 2h-\.44/);
  assert.match(preview, /role="status"/);
  assert.match(preview, /hasUserSelected \? QUESTION_FEEDBACK\[activeQuestion\] : ''/);
  assert.match(preview, /aria-label=\{status \? `\$\{label\}: yes` : undefined\}/);

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

  assert.match(livingHeroStyles, /Living Asset Record homepage hero, September 2026/);
  assert.match(livingHeroStyles, /\.heroMedia \.shell \{[\s\S]*?width: var\(--shell-width\)/);
  assert.match(livingHeroStyles, /\.heroMedia \{[\s\S]*?min-height: clamp\(32rem, 34vw, 36rem\);[\s\S]*?background: transparent/);
  assert.doesNotMatch(livingHeroStyles, /\.heroMedia::before|\.heroMedia::after/);
  assert.match(livingHeroStyles, /\.heroGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(0, 50rem\)/);
  assert.match(livingHeroStyles, /\.assetHeroStage \{[\s\S]*?width: 50rem;[\s\S]*?aspect-ratio: 1000 \/ 560;[\s\S]*?transform: translate\(5\.5rem, -1\.25rem\)/);
  assert.match(livingHeroStyles, /\.assetQuestion \{[\s\S]*?--question-size: 6\.25rem/);
  assert.match(livingHeroStyles, /\.assetQuestionActive \{[\s\S]*?--question-size: 6\.6rem/);
  assert.match(styles, /\.assetPreviewCard \{[\s\S]*?border: 1px solid rgba\(151, 205, 181, 0\.9\)/);
  assert.match(styles, /\.assetPreviewCard \{[\s\S]*?top: 9%;[\s\S]*?right: 17%;[\s\S]*?bottom: 16%;[\s\S]*?left: 17%/);
  assert.match(styles, /\.assetPreviewBody \{[\s\S]*?grid-template-columns: minmax\(0, 1\.37fr\) minmax\(0, 1fr\) minmax\(0, 2fr\)/);
  assert.match(styles, /\.assetConnectors circle \{[\s\S]*?fill: rgba\(115, 176, 151, 0\.78\)/);
  assert.match(styles, /\.assetQuestionActive \{[\s\S]*?linear-gradient\(145deg, #1bb27d 0%, #087d56 100%\)/);
  assert.match(styles, /\.assetQuestion:focus-visible \{[\s\S]*?outline: 3px solid/);
  assert.match(styles, /\.assetQuestionHave \{[\s\S]*?top: 0\.3%;[\s\S]*?left: 0/);
  assert.match(styles, /\.assetQuestionWorth \{[\s\S]*?top: 9\.7%;[\s\S]*?right: 0/);
  assert.match(styles, /\.assetQuestionCost \{[\s\S]*?bottom: 7%;[\s\S]*?left: 0/);
  assert.match(styles, /\.assetQuestionAttention \{[\s\S]*?right: 2%;[\s\S]*?bottom: 0/);
  assert.match(styles, /\.roleSection \{[\s\S]*?scroll-margin-top: 7rem/);
  assert.match(styles, /\.roleSection \{[\s\S]*?background: transparent/);
  assert.match(styles, /\.roleTitle:focus-visible \{[\s\S]*?outline: 3px solid/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*?\.heroGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.assetQuestionGroup \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.assetDocumentsPanel \{[\s\S]*?display: flex/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.assetPreviewCard\[data-active-question='cost'\] \.assetDocumentsPanel \{[\s\S]*?display: flex/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /\.assetPreviewActions \{[\s\S]*?pointer-events: none/);
  assert.match(styles, /home-asset-hilux-thumb-side\.webp/);
  assert.match(styles, /home-asset-hilux-thumb-rear\.webp/);
  assert.match(styles, /home-asset-hilux-thumb-alt\.webp/);
});
