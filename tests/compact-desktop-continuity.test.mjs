import assert from 'node:assert/strict';
import test from 'node:test';
import { read, assertNoWebsiteReflow } from './helpers/site-layout-audit.mjs';

test('intermediate desktop and short screens use the canonical Home and header composition', async () => {
  for (const file of ['app/page.module.css', 'components/AppHeader.module.css', 'components/AppFooter.module.css', 'components/AppPatternBackground.module.css']) {
    assertNoWebsiteReflow(await read(file), file);
  }
  const layout = await read('app/layout.tsx');
  assert.doesNotMatch(layout, /compact-desktop-continuity|header-manage-tuning/);
  const home = await read('app/home-hero-experience.tsx');
  assert.doesNotMatch(home, /DESKTOP_STORY_QUERY|desktopStoryMedia/);
  assert.match(home, /supportsStory = !reducedMotionMedia\.matches/);
});
