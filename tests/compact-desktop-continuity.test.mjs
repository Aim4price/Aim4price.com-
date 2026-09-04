import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('root layout loads the compact desktop continuity layer last', async () => {
  const layout = await read('app/layout.tsx');

  assert.match(layout, /import '\.\/compact-desktop-continuity\.css';/);
  assert.ok(
    layout.indexOf("import './compact-desktop-continuity.css';")
      > layout.indexOf("import './asset-register-view-tuning.css';"),
  );
});

test('901 to 1180 header stays a clean two-row compact desktop header', async () => {
  const styles = await read('app/compact-desktop-continuity.css');

  const compactHeader = styles.slice(
    styles.indexOf('@media (min-width: 901px) and (max-width: 1180px)'),
    styles.indexOf('901–1180px is not a phone layout.'),
  );

  assert.match(compactHeader, /grid-template-areas:[\s\S]*?'brand actions'[\s\S]*?'nav nav' !important/);
  assert.match(compactHeader, /nav\[aria-label='Primary navigation'\][\s\S]*?width: 100% !important/);
  assert.match(compactHeader, /nav\[aria-label='Primary navigation'\][\s\S]*?> div \{[\s\S]*?flex-wrap: nowrap !important/);
  assert.match(compactHeader, /nav\[aria-label='Primary navigation'\][\s\S]*?> div[\s\S]*?> a \{[\s\S]*?flex: 1 1 0 !important[\s\S]*?min-width: 0 !important/);
  assert.match(compactHeader, /white-space: nowrap !important[\s\S]*?overflow: hidden !important/);
  assert.match(compactHeader, /nav\[aria-label='Primary navigation'\]:has\(> button\)[\s\S]*?width: min\(calc\(100% - 3rem\), 46rem\) !important/);
  assert.match(compactHeader, /> div > div:last-child \{[\s\S]*?grid-area: actions !important[\s\S]*?justify-self: end !important/);
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
  assert.doesNotMatch(narrow, /display:\s*none[^}]*nav\[aria-label='Primary navigation'\]/);
});
