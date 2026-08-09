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
  assert.doesNotMatch(client, /assetValueVatModes\[asset\.id\] \?\? 'excluded'/);
});

test('asset quick actions live inside the asset card', () => {
  assert.match(
    client,
    /<article[\s\S]*?<div className=\{styles\.assetSideActions\} role="group"[\s\S]*?<div className=\{styles\.assetHeader\}>/,
  );
  assert.match(styles, /\.assetCard > \.assetSideActions \{/);
  assert.match(styles, /\.assetCard > \.assetHeader > \.assetTitleBlock \{[\s\S]*?padding-left:/);
});

test('the per-asset VAT control stays aligned with its amount', () => {
  assert.match(
    client,
    /assetValueVatAmountRow[\s\S]*?<strong>\{money\(displayedAssetValue\)\}<\/strong>[\s\S]*?assetCardVatToggle/,
  );
  assert.doesNotMatch(client, /<\/article>\s*<button[\s\S]{0,400}assetCardVatToggle/);
  assert.match(styles, /\.assetValueVatAmountRow \{[\s\S]*?flex-wrap: nowrap;[\s\S]*?align-items: center;/);
  assert.match(styles, /\.assetValueVatAmountRow \.assetCardVatToggle \{[\s\S]*?position: static !important;/);
});

test('the global VAT selector clearly explains its scope', () => {
  assert.match(client, /Show all asset values/);
  assert.match(client, /aria-label="VAT display for all asset values"/);
  assert.match(styles, /\.heroVatFooter \.vatToggleGroup \{[\s\S]*?border: 2px solid/);
  assert.match(styles, /\.heroVatFooter \.vatToggleButtonActive \{[\s\S]*?background:/);
});
