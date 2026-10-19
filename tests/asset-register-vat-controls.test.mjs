import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8');

test('the register VAT selector updates the total and every asset card', () => {
  assert.match(
    client,
    /function handleRegisterValueVatModeChange\(nextMode: 'excluded' \| 'included'\) \{\s*setRegisterValueVatMode\(nextMode\);\s*setReplacementValueVatMode\(nextMode\);\s*setAssetValueVatModes\(\{\}\);/,
  );
  assert.match(client, /assetValueVatModes\[asset\.id\] \?\? registerValueVatMode/);
  assert.match(client, /Number\(asset\.value \|\| 0\) \* ASSET_REGISTER_SUMMARY_VAT_MULTIPLIER/);
  assert.match(client, /handleRegisterValueVatModeChange\('excluded'\)/);
  assert.match(client, /handleRegisterValueVatModeChange\('included'\)/);
});

test('asset and umbrella quick actions share an in-card footer', () => {
  assert.equal((client.match(/className=\{styles\.sharedCardFooter\}/g) ?? []).length, 2);
  assert.equal((client.match(/className=\{styles\.sharedCardUtilities\}/g) ?? []).length, 2);
  assert.match(styles, /\.assetSideActions\{position:static !important;display:flex !important/);
});

test('asset and umbrella prices share the explicit VAT selector', () => {
  const priceSwitch = readFileSync(new URL('../components/asset-register/AssetPriceSwitch.tsx', import.meta.url), 'utf8');
  assert.match(priceSwitch, /<PricingVatToggle included=\{included\} onChange=\{onVatChange\}/);
  assert.match(client, /<PricingVatToggle included=\{groupValueVatMode === 'included'\}/);
  assert.match(client, /if \(included !== \(groupValueVatMode === 'included'\)\) handleAssetGroupValueVatToggle/);
  assert.match(client, /assetGroupValueVatModes\[group.id\] \?\? registerValueVatMode/);
  assert.match(client, /setAssetGroupValueVatModes\(\{\}\)/);
});

test('the Register value selector continues to match Replacement value', () => {
  assert.doesNotMatch(client, /Show all asset values as/);
  assert.ok((client.match(/className=\{styles\.vatToggleGroup\}/g) ?? []).length >= 2);
  assert.match(styles, /\.heroVatFooter \.vatToggleGroup \{[\s\S]*?width: 100%;/);
});
