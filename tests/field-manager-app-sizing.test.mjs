import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stylesUrl = new URL('../app/field-manager/page.module.css', import.meta.url);
const navStylesUrl = new URL('../app/field-manager/field-manager-nav-link.module.css', import.meta.url);

test('Field Manager keeps wide phones large and single-column', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  const widePhoneStart = styles.indexOf('@media (min-width: 540px) and (max-width: 767px)');
  const tabletStart = styles.indexOf('@media (min-width: 768px)', widePhoneStart);

  assert.ok(widePhoneStart >= 0, 'Field Manager must define a wide-phone sizing band');
  assert.ok(tabletStart > widePhoneStart, 'Field Manager tablet rules must follow wide-phone rules');

  const widePhoneStyles = styles.slice(widePhoneStart, tabletStart);
  assert.match(widePhoneStyles, /\.homeActionGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(widePhoneStyles, /\.assetList,[\s\S]*?\.overviewList\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(widePhoneStyles, /\.homeActionCard\s*\{[\s\S]*?min-height:\s*170px;/);
  assert.match(widePhoneStyles, /\.mobileField input,[\s\S]*?\.searchField input\s*\{[\s\S]*?min-height:\s*86px;/);
  assert.match(widePhoneStyles, /\.assetMetaGrid div\s*\{[\s\S]*?min-height:\s*116px;/);
  assert.match(widePhoneStyles, /\.assetOpenButton\s*\{[\s\S]*?min-height:\s*104px;/);
});

test('Field Manager navigation follows the wide-phone touch scale', async () => {
  const styles = await readFile(navStylesUrl, 'utf8');
  const widePhoneStart = styles.indexOf('@media (min-width: 540px) and (max-width: 767px)');
  const tabletStart = styles.indexOf('@media (min-width: 768px)', widePhoneStart);

  assert.ok(widePhoneStart >= 0);
  assert.ok(tabletStart > widePhoneStart);
  assert.match(styles.slice(widePhoneStart, tabletStart), /\.navLink\s*\{[\s\S]*?min-height:\s*88px;/);
});

test('Field Manager switches to tablet grids only at 768px', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  const tabletStart = styles.indexOf('@media (min-width: 768px)');

  assert.ok(tabletStart >= 0);
  const tabletStyles = styles.slice(tabletStart);
  assert.match(tabletStyles, /\.homeActionGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/);
  assert.match(tabletStyles, /\.assetList,[\s\S]*?\.overviewList\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/);
});
