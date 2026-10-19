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

test('asset quick actions retain the original side rail', () => {
  assert.match(client, /<article[\s\S]*?styles\.assetSideActions[\s\S]*?aria-label=\{`Actions for/);
  assert.doesNotMatch(client, /styles\.sharedCardFooter/);
  assert.match(styles, /\.assetSideActions \{[\s\S]*?left: calc\(0rem - clamp/);
});

test('asset and umbrella prices retain independent VAT controls', () => {
  assert.match(client, /<AssetPriceSwitch[\s\S]*?included=\{assetValueVatMode\s*===\s*'included'\}/);
  const pricing = readFileSync(new URL('../components/asset-register/AssetPriceSwitch.tsx', import.meta.url), 'utf8');
  assert.match(pricing, /<PricingVatToggle included=\{included\} onChange=\{onVatChange\}/);
  assert.match(client, /<CardVatToggle included=\{groupValueVatMode === 'included'\}/);
  assert.match(client, /assetGroupValueVatModes\[group.id\] \?\? registerValueVatMode/);
  assert.match(client, /setAssetGroupValueVatModes\(\{\}\)/);
  const toggleStyles = readFileSync(new URL('../components/CardVatToggle.module.css', import.meta.url), 'utf8');
  assert.match(toggleStyles, /position: absolute/);
  assert.match(toggleStyles, /background: transparent/);
});

test('the Register value selector continues to match Replacement value', () => {
  assert.doesNotMatch(client, /Show all asset values as/);
  assert.ok((client.match(/className=\{styles\.vatToggleGroup\}/g) ?? []).length >= 2);
  assert.match(styles, /\.heroVatFooter \.vatToggleGroup \{[\s\S]*?width: 100%;/);
});
