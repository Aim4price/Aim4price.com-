import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Marketplace entry uses concise Aim4price wording', async () => {
  const source = await read('app/marketplace/page.tsx');

  assert.match(source, /Explore assets on Aim4price/);
  assert.match(source, /Discover owner-approved assets or browse machinery currently listed for sale/);
  assert.doesNotMatch(source, /Choose an option/);
  assert.doesNotMatch(source, /Choose where you want to go/);
});

test('Marketplace cards and hover videos remain unchanged', async () => {
  const source = await read('app/marketplace/page.tsx');

  assert.match(source, /<strong className=\{valuationStyles\.sectorLabel\}>Discovery<\/strong>/);
  assert.match(source, /<strong className=\{valuationStyles\.sectorLabel\}>Marketplace<\/strong>/);
  assert.match(source, /\/discovery\/Aim4price_Discovery\.mp4/);
  assert.match(source, /\/marketplace\/Aim4price_Marketplace\.mp4/);
  assert.match(source, /muted[\s\S]*loop[\s\S]*playsInline[\s\S]*autoPlay/);
});

test('Marketplace heading polish is isolated to the entry introduction', async () => {
  const [source, styles] = await Promise.all([
    read('app/marketplace/page.tsx'),
    read('app/marketplace/marketplace-entry.module.css'),
  ]);

  assert.match(styles, /\.entryTitle\.entryTitle/);
  assert.match(styles, /white-space: nowrap/);
  assert.match(styles, /\.entryText\.entryText/);
  assert.doesNotMatch(source, /entryEyebrow/);
  assert.doesNotMatch(styles, /\.entryEyebrow/);
});

test('Get Estimate, Discovery and Marketplace wording aligns at the bottom', async () => {
  const [source, styles, valuationStyles] = await Promise.all([
    read('app/marketplace/page.tsx'),
    read('app/marketplace/marketplace-entry.module.css'),
    read('app/valuation/page.module.css'),
  ]);
  const contentRule = styles.slice(
    styles.indexOf('.entryChoiceContent.entryChoiceContent'),
    styles.indexOf('@media (max-width: 1180px)'),
  );
  const sectorContentRules = [
    ...valuationStyles.matchAll(/\.sectorBigCardContent\s*\{([^}]*)\}/g),
  ].map((match) => match[1]);
  const contentClassUsages = source.match(/entryStyles\.entryChoiceContent/g) ?? [];

  assert.equal(contentClassUsages.length, 2);
  assert.match(contentRule, /justify-content:\s*flex-end/);
  assert.doesNotMatch(contentRule, /justify-content:\s*flex-start/);
  assert.ok(
    sectorContentRules.some((rule) => /justify-content:\s*flex-end/.test(rule)),
    'Get Estimate sector cards should bottom-align their wording',
  );
  assert.ok(
    sectorContentRules.every((rule) => !/justify-content:\s*space-between/.test(rule)),
    'Get Estimate sector cards should not spread wording from top to bottom',
  );
});
