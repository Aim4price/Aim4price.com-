import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('root layout loads Home continuity before the dedicated header foundation', async () => {
  const layout = await read('app/layout.tsx');

  assert.match(layout, /import '\.\/compact-desktop-continuity\.css';/);
  assert.match(layout, /import '\.\/header-foundation\.css';/);
  assert.ok(
    layout.indexOf("import './compact-desktop-continuity.css';")
      > layout.indexOf("import './asset-register-view-tuning.css';"),
  );
  assert.ok(
    layout.indexOf("import './header-foundation.css';")
      > layout.indexOf("import './compact-desktop-continuity.css';"),
  );
});

test('compact desktop continuity is Home-only and no longer owns header geometry', async () => {
  const styles = await read('app/compact-desktop-continuity.css');

  assert.match(styles, /Compact desktop Home continuity/);
  assert.doesNotMatch(styles, /Go to Aim4price home|Primary navigation|header:has/);
});

test('compact desktop Home uses a static two-column hero instead of the legacy giant stack', async () => {
  const styles = await read('app/compact-desktop-continuity.css');

  assert.match(
    styles,
    /@media \(min-width: 901px\) and \(max-width: 1180px\),[\s\S]*?\(min-width: 1181px\) and \(max-height: 639px\)/,
  );
  assert.match(styles, /grid-template-columns:[\s\S]*?minmax\(20rem, 0\.84fr\)[\s\S]*?minmax\(27rem, 1\.16fr\) !important/);
  assert.match(styles, /> div:first-child \{[\s\S]*?grid-column: 1 !important[\s\S]*?grid-row: 1 !important/);
  assert.match(styles, /> div:nth-child\(2\) \{[\s\S]*?display: none !important/);
  assert.match(styles, /> div:has\(> div\[data-active-question\]\) \{[\s\S]*?grid-column: 2 !important[\s\S]*?width: min\(100%, 36rem\) !important/);
  assert.match(styles, /> aside\[aria-label='What Aim4price helps you do'\] \{[\s\S]*?display: none !important/);
  assert.match(styles, /> div:last-of-type \{[\s\S]*?grid-column: 1 !important[\s\S]*?grid-row: 2 !important[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(styles, /span:first-child \{[\s\S]*?font-size: clamp\(2\.65rem, 5\.1vw, 3\.35rem\) !important/);
  assert.match(styles, /span:not\(:first-child\) \{[\s\S]*?font-size: clamp\(1\.7rem, 3\.25vw, 2\.15rem\) !important/);
});

test('narrow compact desktop tightens the preview without becoming mobile', async () => {
  const styles = await read('app/compact-desktop-continuity.css');
  const narrow = styles.slice(styles.indexOf('@media (min-width: 901px) and (max-width: 980px)'));

  assert.match(narrow, /minmax\(18\.5rem, 0\.82fr\)/);
  assert.match(narrow, /minmax\(25rem, 1\.18fr\) !important/);
  assert.match(narrow, /width: min\(100%, 33rem\) !important/);
});
