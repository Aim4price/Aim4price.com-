import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stylesUrl = new URL('../app/owner-app/owner-app.module.css', import.meta.url);

test('Owner App keeps wide phones large and single-column', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  const widePhoneStart = styles.indexOf('@media (min-width: 540px) and (max-width: 767px)');
  const tabletStart = styles.indexOf('@media (min-width: 768px)', widePhoneStart);

  assert.ok(widePhoneStart >= 0, 'Owner App must define a wide-phone sizing band');
  assert.ok(tabletStart > widePhoneStart, 'Owner App tablet rules must start after the wide-phone rules');

  const widePhoneStyles = styles.slice(widePhoneStart, tabletStart);
  assert.match(widePhoneStyles, /\.homeLauncher\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(widePhoneStyles, /\.managerAssetList\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(widePhoneStyles, /\.homeLaunchCard\s*\{[\s\S]*?min-height:\s*176px;/);
  assert.match(widePhoneStyles, /\.managerAssetMetaGrid div\s*\{[\s\S]*?min-height:\s*116px;/);
  assert.match(widePhoneStyles, /\.navButton,[\s\S]*?\.logoutButton\s*\{[\s\S]*?min-height:\s*84px;/);
  assert.match(widePhoneStyles, /\.ownerAssetOpenButton,[\s\S]*?\.assetMirrorAction\s*\{[\s\S]*?min-height:\s*96px;/);
});

test('Owner App only switches to the two-column tablet layout at 768px', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  const tabletStart = styles.indexOf('@media (min-width: 768px)');

  assert.ok(tabletStart >= 0, 'Owner App must define its tablet breakpoint at 768px');
  const tabletStyles = styles.slice(tabletStart);
  assert.match(tabletStyles, /\.homeLauncher\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/);
  assert.match(tabletStyles, /\.managerAssetList\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/);
});
