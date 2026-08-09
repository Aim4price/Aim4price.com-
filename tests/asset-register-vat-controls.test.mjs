import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8');

test('the register VAT selector updates the total and every asset card', () => {
  assert.match(
    client,
    /function handleRegisterValueVatModeChange\(nextMode: 'excluded' \| 'included'\) \{\s*setRegisterValueVatMode\(nextMode\);\s*setAssetValueVatModes\(\{\}\);/,
  );
  assert.match(client, /assetValueVatModes\[asset\.id\] \?\? registerValueVatMode/);
  assert.match(client, /Number\(asset\.value \|\| 0\) \* ASSET_REGISTER_SUMMARY_VAT_MULTIPLIER/);
  assert.match(client, /handleRegisterValueVatModeChange\('excluded'\)/);
  assert.match(client, /handleRegisterValueVatModeChange\('included'\)/);
});

test('asset quick actions remain outside the asset card', () => {
  assert.match(
    client,
    /assetCardRow[\s\S]*?<div className=\{styles\.assetSideActions\}>[\s\S]*?<article/,
  );
  assert.doesNotMatch(client, /<article[\s\S]{0,1200}<div className=\{styles\.assetSideActions\}/);
  assert.match(styles, /\.assetSideActions \{[\s\S]*?position: absolute;[\s\S]*?left:/);
  assert.doesNotMatch(styles, /\.assetCard > \.assetSideActions/);
});

test('the per-asset VAT arrow remains outside the asset card', () => {
  assert.match(client, /<\/article>\s*<button[\s\S]{0,500}assetCardVatToggle/);
  assert.doesNotMatch(client, /assetValueVatAmountRow/);
  assert.match(styles, /\.assetCardVatToggle \{[\s\S]*?position: absolute;[\s\S]*?right:/);
});

test('the Register value selector matches the Replacement value selector', () => {
  assert.match(client, /Show all asset values as/);
  assert.match(client, /aria-label="VAT display for all asset values"/);
  assert.ok((client.match(/className=\{styles\.vatToggleGroup\}/g) ?? []).length >= 2);
  assert.match(styles, /\.vatToggleControl \{[\s\S]*?width: 100%;/);
  assert.match(styles, /\.vatTogglePrompt \{[\s\S]*?text-align: center;/);
  assert.match(styles, /\.heroVatFooter \.vatToggleGroup \{[\s\S]*?width: 100%;/);
});
