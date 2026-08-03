import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [assetModal, ownerAccess, fieldManagerAccess, friendlySelect, focusStyles] = await Promise.all([
  read('app/asset-register/asset-register-client.tsx'),
  read('app/account/owner-app/owner-app-access-client.tsx'),
  read('app/account/field-manager/field-manager-client.tsx'),
  read('app/account/friendly-select.tsx'),
  read('app/account/access-page-refinements.module.css'),
]);

test('Update Asset usage uses the friendly Aim4price selector', () => {
  assert.match(assetModal, /<ModalSelect<AssetDraftUsageMetric>/);
  assert.match(assetModal, /label="Usage type"/);
  assert.match(assetModal, /usePortal/);
  assert.doesNotMatch(assetModal, /className=\{styles\.assetUsageTypeSelect\}/);
});

test('Owner and Field Manager access selectors avoid browser-native menus', () => {
  assert.match(ownerAccess, /<FriendlySelect/);
  assert.match(fieldManagerAccess, /<FriendlySelect/);
  assert.doesNotMatch(ownerAccess, /<select value=\{draft\.accessRole\}/);
  assert.doesNotMatch(fieldManagerAccess, /<select value=\{settings\.(assetScope|fuelScope)\}/);
  assert.match(friendlySelect, /createPortal/);
  assert.match(friendlySelect, /role="listbox"/);
  assert.match(friendlySelect, /aria-selected=\{active\}/);
});

test('Access pages focus one user and mute the remaining cards', () => {
  assert.match(ownerAccess, /accessStyles\.focusedCard/);
  assert.match(ownerAccess, /accessStyles\.mutedCard/);
  assert.match(fieldManagerAccess, /accessStyles\.focusedCard/);
  assert.match(fieldManagerAccess, /accessStyles\.mutedCard/);
  assert.match(focusStyles, /filter: blur\(1\.5px\)/);
  assert.match(focusStyles, /pointer-events: none/);
});
