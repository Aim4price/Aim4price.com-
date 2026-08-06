import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Dealer Account staff role controls use the refined shared dropdown', async () => {
  const [client, styles] = await Promise.all([
    source('app/account/dealer-app/dealer-access-client.tsx'),
    source('app/account/dealer-app/page.module.css'),
  ]);

  assert.match(client, /function RoleSelect/);
  assert.match(client, /className=\{styles\.roleSelectWrap\}/);
  assert.match(client, /className=\{styles\.roleSelectChevron\}/);
  assert.equal((client.match(/<RoleSelect/g) ?? []).length, 2);
  assert.match(client, /<option key=\{option\.value\} value=\{option\.value\}>\{option\.label\}<\/option>/);
  assert.match(styles, /\.field \.roleSelectWrap select,[\s\S]*?appearance: none/);
  assert.match(styles, /\.roleSelectChevron \{[\s\S]*?pointer-events: none/);
  assert.match(styles, /\.roleSelectWrap:focus-within \.roleSelectChevron/);
});

test('Dealer Account staff roles use a polished green badge', async () => {
  const [client, styles] = await Promise.all([
    source('app/account/dealer-app/dealer-access-client.tsx'),
    source('app/account/dealer-app/page.module.css'),
  ]);

  assert.match(client, /<small className=\{styles\.rolePill\}>\{roleLabel\(manager\.role\)\}<\/small>/);
  assert.match(styles, /\.managerIdentity \.rolePill \{[\s\S]*?border: 1px solid rgba\(31, 138, 102, 0\.16\)/);
  assert.match(styles, /\.managerIdentity \.rolePill::before \{[\s\S]*?background: #21966f/);
});
