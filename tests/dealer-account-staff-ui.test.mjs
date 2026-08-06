import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Dealer Account staff role controls use a fully custom shared dropdown', async () => {
  const [client, styles] = await Promise.all([
    source('app/account/dealer-app/dealer-access-client.tsx'),
    source('app/account/dealer-app/page.module.css'),
  ]);

  assert.match(client, /function RoleSelect/);
  assert.match(client, /function RoleIcon/);
  assert.match(client, /styles\.roleSelectWrap/);
  assert.match(client, /styles\.roleSelectWrapOpen/);
  assert.match(client, /className=\{styles\.roleSelectButton\}/);
  assert.match(client, /className=\{styles\.roleSelectChevron\}/);
  assert.equal((client.match(/<RoleSelect/g) ?? []).length, 2);
  assert.doesNotMatch(client, /<select\b|<option\b/);
  assert.match(client, /aria-haspopup="listbox"/);
  assert.match(client, /role="listbox"/);
  assert.match(client, /role="option"/);
  assert.match(client, /<small>\{option\.description\}<\/small>/);
  assert.match(client, /event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'/);
  assert.match(styles, /\.roleSelectButton \{[\s\S]*?background: linear-gradient/);
  assert.match(styles, /\.roleSelectMenu \{[\s\S]*?position: absolute/);
  assert.match(styles, /\.roleSelectWrapOpen \{[\s\S]*?z-index: 40/);
  assert.match(styles, /\.roleSelectOptionSelected \{/);
  assert.match(styles, /\.roleSelectChevron \{[\s\S]*?pointer-events: none/);
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
