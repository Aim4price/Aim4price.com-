import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('desktop Manage control and dropdown keep deliberate spacing', async () => {
  const [layout, tuning] = await Promise.all([
    read('app/layout.tsx'),
    read('app/header-manage-tuning.css'),
  ]);

  assert.match(layout, /import '\.\/header-manage-tuning\.css';/);
  assert.match(tuning, /@media \(min-width: 1181px\)/);
  assert.match(tuning, /header:has\(button\[aria-label='Open manage menu'\]\) > div\s*\{[\s\S]*?left: -1rem;/);
  assert.match(tuning, /div:has\(> button\[aria-label='Open manage menu'\]\)\s*\{[\s\S]*?min-width: 14\.75rem;/);
  assert.match(tuning, /button\[aria-label='Open manage menu'\]\s*\{[\s\S]*?min-width: 14\.75rem;[\s\S]*?gap: 0\.95rem;[\s\S]*?padding-inline: 1\.08rem;/);
  assert.match(tuning, /#header-account-menu\s*\{[\s\S]*?min-width: max\(18rem, 100%\);/);
});
