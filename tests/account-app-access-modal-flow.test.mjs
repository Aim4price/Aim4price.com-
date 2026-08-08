import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Owner, Field Manager and Dealer staff access use one clear New and Manage launcher', async () => {
  const [shared, dealer, owner, field] = await Promise.all([
    read('app/account/app-access-management-client.tsx'),
    read('app/account/dealer-app/dealer-access-client.tsx'),
    read('app/account/owner-app/owner-app-access-client.tsx'),
    read('app/account/field-manager/field-manager-client.tsx'),
  ]);

  assert.match(shared, /<strong>New<\/strong>/);
  assert.match(shared, /<strong>Manage<\/strong>/);
  assert.match(shared, /onNew=\{\(\) => openFlow\('new'\)\}/);
  assert.match(shared, /onManage=\{\(\) => openFlow\('manage'\)\}/);
  assert.match(shared, /open=\{activeFlow === 'new'\}/);
  assert.match(shared, /open=\{activeFlow === 'manage'\}/);
  assert.match(shared, /title=\{selectedRecord \? `Manage \$\{selectedRecord\.displayName\}` : config\.itemPlural\}/);

  assert.match(dealer, /DealerAppAccessManagement as default/);
  assert.match(owner, /OwnerAppAccessManagement as default/);
  assert.match(field, /FieldManagerAppAccessManagement as default/);
});

test('shared access flows preserve each app login type and its existing controls', async () => {
  const shared = await read('app/account/app-access-management-client.tsx');

  assert.match(shared, /listEndpoint: '\/api\/dealer\/staff'/);
  assert.match(shared, /listEndpoint: '\/api\/owner-app\/users'/);
  assert.match(shared, /listEndpoint: '\/api\/field-managers'/);
  assert.match(shared, /roleField: 'role'/);
  assert.match(shared, /roleField: 'accessRole'/);
  assert.match(shared, /roleField: null/);
  assert.match(shared, /Owner \/ Manager/);
  assert.match(shared, /Operations/);
  assert.match(shared, /FieldManagerAccessPanel/);
  assert.match(shared, /Save access/);
  assert.match(shared, /Deactivate/);
  assert.match(shared, /Activate/);
  assert.match(shared, /Delete/);
  assert.match(shared, /Copy link/);
  assert.match(shared, /Share link/);
});

test('access launcher and dialogs stay large, focused and responsive', async () => {
  const styles = await read('app/account/app-access-management.module.css');

  assert.match(styles, /\.actionGrid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.actionButton \{[\s\S]*?min-height: clamp\(9rem, 14vw, 11\.5rem\)/);
  assert.match(styles, /\.modalOverlay \{[\s\S]*?position: fixed;[\s\S]*?z-index: 12000/);
  assert.match(styles, /\.modalBody \{[\s\S]*?overflow-y: auto/);
  assert.match(styles, /\.modalWide \{[\s\S]*?width: min\(100%, 72rem\)/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.actionGrid \{[\s\S]*?grid-template-columns: 1fr/);
});
