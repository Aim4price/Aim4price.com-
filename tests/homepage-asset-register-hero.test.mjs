import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage presents the living Asset Register hero and role choice', async () => {
  const [page, preview, styles, auth] = await Promise.all([
    read('app/page.tsx'),
    read('app/home-asset-preview.tsx'),
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

  assert.match(page, /href="\/valuation"[\s\S]*?Get Free Estimate/);
  assert.match(page, /<a href="#choose-role" className=\{styles\.secondaryCta\}>[\s\S]*?See How It Works/);
  assert.match(
    page,
    /<section[\s\S]*?id="choose-role"[\s\S]*?aria-labelledby="choose-role-title"/,
  );
  assert.match(page, /id="choose-role-title"[\s\S]*?Which best describes you\?/);
  assert.match(page, /I own or manage assets/);
  assert.match(page, /I sell, service or support assets/);
  assert.match(page, /href="\/auth\?accountType=owner#signup"/);
  assert.match(page, /href="\/auth\?accountType=dealer#signup"/);
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
  assert.match(preview, /\/brand\/home-asset-hilux\.webp/);
  assert.match(preview, /alt="White Toyota Hilux single-cab work vehicle in a farm equipment yard"/);
  assert.doesNotMatch(preview, /registration|serial|CAW 122854/i);
  assert.doesNotMatch(preview, /fetch\(|\/api\/asset-register|asset-register-client/);
  assert.match(preview, /assetPreviewActions} aria-hidden="true"/);
  assert.match(preview, /assetPhotoAction} aria-hidden="true"/);
  assert.match(preview, /assetDocumentAction} aria-hidden="true"/);
  assert.match(preview, /aria-label=\{status \? `\$\{label\}: yes` : undefined\}/);

  const heroImage = await stat(
    new URL('../public/brand/home-asset-hilux.webp', import.meta.url),
  );
  assert.ok(heroImage.size > 20_000);
  assert.ok(heroImage.size < 150_000);

  assert.match(styles, /Living Asset Record homepage hero, September 2026/);
  assert.match(styles, /\.heroMedia \.shell \{[\s\S]*?width: min\(calc\(100% - 3rem\), 92rem\)/);
  assert.match(styles, /\.heroGrid \{[\s\S]*?grid-template-columns: minmax\(25rem, 0\.86fr\) minmax\(42rem, 1\.14fr\)/);
  assert.match(styles, /\.assetPreviewCard \{[\s\S]*?border: 1px solid rgba\(151, 205, 181, 0\.9\)/);
  assert.match(styles, /\.assetQuestionActive \{[\s\S]*?linear-gradient\(145deg, #1bb27d 0%, #087d56 100%\)/);
  assert.match(styles, /\.assetQuestion:focus-visible \{[\s\S]*?outline: 3px solid/);
  assert.match(styles, /\.assetQuestionHave \{[\s\S]*?top: 0\.3%;[\s\S]*?left: 0/);
  assert.match(styles, /\.assetQuestionWorth \{[\s\S]*?top: 18%;[\s\S]*?right: 0/);
  assert.match(styles, /\.assetQuestionCost \{[\s\S]*?bottom: 0\.5%;[\s\S]*?left: 0/);
  assert.match(styles, /\.assetQuestionAttention \{[\s\S]*?right: 0\.5%;[\s\S]*?bottom: 0\.4%/);
  assert.match(styles, /\.roleSection \{[\s\S]*?scroll-margin-top: 7rem/);
  assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*?\.heroGrid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.assetQuestionGroup \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.assetPreviewCard\[data-active-question='cost'\] \.assetPreviewBody \{[\s\S]*?grid-template-rows: minmax\(0, 1fr\) minmax\(5rem, auto\)/);
  assert.match(styles, /\.assetPreviewCard\[data-active-question='cost'\] \.assetDocumentsPanel \{[\s\S]*?display: flex;[\s\S]*?grid-row: 2/);
  assert.match(styles, /\.assetPreviewCard\[data-active-question='cost'\] \.assetDetailsPanel \{[\s\S]*?grid-row: 1 \/ span 2/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /\.assetPreviewActions \{[\s\S]*?pointer-events: none/);
});
