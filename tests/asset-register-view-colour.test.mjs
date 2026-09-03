import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Asset Register Overview / Assets switch uses the lighter selected treatment', async () => {
  const [layout, tuning] = await Promise.all([
    read('app/layout.tsx'),
    read('app/asset-register-view-tuning.css'),
  ]);

  assert.match(layout, /import '\.\/asset-register-view-tuning\.css';/);
  assert.match(tuning, /\[aria-label='Choose Asset Register view'\] > button\[aria-pressed='true'\]/);
  assert.match(tuning, /rgba\(235, 248, 242, 0\.98\)/);
  assert.match(tuning, /color: #0f5f49 !important/);
  assert.match(tuning, /small \{\s*color: #688179 !important;/);
  assert.doesNotMatch(tuning, /#0d3129|var\(--brand-dark\)/);
});
