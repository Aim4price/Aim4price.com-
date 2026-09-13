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

test('asset quick actions use a subtle boxed rail outside the asset card', () => {
  assert.match(
    client,
    /assetCardRow[\s\S]*?<div className=\{styles\.assetSideActions\}>[\s\S]*?<article/,
  );
  assert.doesNotMatch(client, /<article[\s\S]{0,1200}<div className=\{styles\.assetSideActions\}/);
  assert.match(styles, /\.assetSideActions \{[\s\S]*?left: calc\(0rem - clamp[\s\S]*?padding: 0\.2rem;[\s\S]*?background: rgba\(255, 255, 255, 0\.7\)/);
  assert.match(styles, /\.assetSideActions \.assetFlagButton,[\s\S]*?width: 2\.08rem;[\s\S]*?box-shadow: none;/);
});

test('asset and umbrella prices share an inline VAT control', () => {
  assert.match(client, /<CardVatToggle included=\{assetValueVatMode === 'included'\}/);
  assert.match(client, /<CardVatToggle included=\{groupValueVatMode === 'included'\}/);
  assert.match(client, /assetGroupValueVatModes\[group.id\] \?\? registerValueVatMode/);
  assert.match(client, /setAssetGroupValueVatModes\(\{\}\)/);
  const toggleStyles = readFileSync(new URL('../components/CardVatToggle.module.css', import.meta.url), 'utf8');
  assert.match(toggleStyles, /position: relative/);
  assert.doesNotMatch(toggleStyles, /position: absolute/);
});

test('the Register value selector continues to match Replacement value', () => {
  assert.doesNotMatch(client, /Show all asset values as/);
  assert.ok((client.match(/className=\{styles\.vatToggleGroup\}/g) ?? []).length >= 2);
  assert.match(styles, /\.heroVatFooter \.vatToggleGroup \{[\s\S]*?width: 100%;/);
});
