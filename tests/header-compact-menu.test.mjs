import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('compact Menu is layered after the restored header foundation', async () => {
  const [layout, foundation, menu] = await Promise.all([
    read('app/layout.tsx'),
    read('app/header-foundation.css'),
    read('app/header-compact-menu.css'),
  ]);

  assert.match(layout, /import '\.\/header-foundation\.css';/);
  assert.match(layout, /import '\.\/header-compact-menu\.css';/);
  assert.ok(
    layout.indexOf("import './header-compact-menu.css';")
      > layout.indexOf("import './header-foundation.css';"),
  );

  // PRs #577/#578 modified the foundation itself. Keep those changes reverted:
  // foundation owns geometry; compact Menu presentation lives in its own layer.
  assert.match(foundation, /761-1180px compact: brand\/actions row \+ full-width nav row/);
  assert.match(foundation, /'brand actions'[\s\S]*?'nav nav' !important/);
  assert.doesNotMatch(foundation, /#app-header-mobile-menu|button\[aria-controls='app-header-mobile-menu'\]/);
  assert.match(menu, /Compact website navigation menu/);
});

test('761 to 1180 becomes one header row with Menu instead of a second navigation row', async () => {
  const menu = await read('app/header-compact-menu.css');
  const compactStart = menu.indexOf('@media (min-width: 761px) and (max-width: 1180px)');
  const reducedMotionStart = menu.indexOf('@media (prefers-reduced-motion: reduce)');
  const compact = menu.slice(compactStart, reducedMotionStart);

  assert.ok(compactStart >= 0);
  assert.match(compact, /grid-template-areas: 'brand actions' !important/);
  assert.doesNotMatch(compact, /'nav nav'/);
  assert.match(compact, /nav\[aria-label='Primary navigation'\][\s\S]*?display: none !important/);
  assert.match(compact, /> div:last-child \{[\s\S]*?grid-area: actions !important/);
  assert.match(compact, /button\[aria-controls='app-header-mobile-menu'\][\s\S]*?display: inline-flex !important[\s\S]*?order: -1 !important/);
  assert.match(compact, /button\[aria-controls='app-header-mobile-menu'\]::after[\s\S]*?content: '⌄'/);
  assert.match(compact, /div:has\(> \[aria-label='Open manage menu'\]\)[\s\S]*?display: block !important/);
});

test('compact Menu is a bounded navigation dropdown rather than the phone drawer', async () => {
  const menu = await read('app/header-compact-menu.css');

  assert.match(
    menu,
    /body > div\[role='presentation'\]:has\(> #app-header-mobile-menu\)[\s\S]*?background: transparent !important[\s\S]*?backdrop-filter: none !important/,
  );
  assert.match(menu, /#app-header-mobile-menu \{[\s\S]*?position: fixed !important/);
  assert.match(menu, /#app-header-mobile-menu \{[\s\S]*?bottom: auto !important[\s\S]*?left: auto !important/);
  assert.match(menu, /#app-header-mobile-menu \{[\s\S]*?width: min\(20\.5rem, calc\(100vw - 2rem\)\) !important/);
  assert.match(
    menu,
    /#app-header-mobile-menu > nav \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important/,
  );
  assert.match(
    menu,
    /#app-header-mobile-menu > div:last-child \{[\s\S]*?display: none !important/,
  );
  assert.match(
    menu,
    /#app-header-mobile-menu > nav > a\[aria-current='page'\][\s\S]*?background: #effaf5 !important/,
  );
});

test('compact Menu does not introduce another set of width endpoints', async () => {
  const menu = await read('app/header-compact-menu.css');
  const widthQueries = (menu.match(/@media \([^\n]+\)/g) ?? []).filter((query) => /width/.test(query));

  // This checks actual media queries rather than prose/comments, so explanatory
  // references to historical widths cannot create a false failure.
  assert.deepEqual(widthQueries, [
    '@media (min-width: 761px) and (max-width: 1180px)',
  ]);
});
