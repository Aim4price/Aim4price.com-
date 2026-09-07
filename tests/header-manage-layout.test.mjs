import assert from 'node:assert/strict';
import test from 'node:test';
import { read, assertNoWebsiteReflow } from './helpers/site-layout-audit.mjs';

test('desktop Manage sizing belongs to the header and applies at every website scale', async () => {
  const [layout,css]=await Promise.all([read('app/layout.tsx'),read('components/AppHeader.module.css')]);
  assert.doesNotMatch(layout,/header-manage-tuning/);
  assertNoWebsiteReflow(css);
  assert.match(css,/\.accountMenu\s*\{[^}]*width: 10\.25rem;[^}]*min-width: 10\.25rem;[^}]*flex: 0 0 10\.25rem;/);
  assert.match(css,/\.accountButton\s*\{[^}]*box-sizing: border-box;[^}]*width: 100%;[^}]*padding-left: 0\.86rem;[^}]*padding-right: 0\.94rem;/);
  assert.match(css,/\.accountPopover\s*\{[^}]*min-width: max\(18rem, 100%\)/);
  assert.match(css,/\.actions \{ min-width: max-content; \}/);
});
