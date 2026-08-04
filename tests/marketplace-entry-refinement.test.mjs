import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Marketplace entry uses concise Aim4price wording', async () => {
  const source = await read('app/marketplace/page.tsx');

  assert.match(source, /Aim4price Marketplace/);
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
  const styles = await read('app/marketplace/marketplace-entry.module.css');

  assert.match(styles, /\.entryEyebrow/);
  assert.match(styles, /\.entryTitle\.entryTitle/);
  assert.match(styles, /\.entryText\.entryText/);
});
