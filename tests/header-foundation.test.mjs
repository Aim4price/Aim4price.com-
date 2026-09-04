import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('header foundation defines exactly three structural width states', async () => {
  const styles = await read('app/header-foundation.css');

  assert.match(styles, /Aim4price website header foundation/);
  assert.match(styles, /@media \(min-width: 1181px\)/);
  assert.match(styles, /@media \(min-width: 761px\) and \(max-width: 1180px\)/);
  assert.match(styles, /@media \(max-width: 760px\)/);

  const structuralQueries = styles.match(/@media \([^\n]+\)/g) ?? [];
  assert.deepEqual(structuralQueries, [
    '@media (min-width: 1181px)',
    '@media (min-width: 761px) and (max-width: 1180px)',
    '@media (max-width: 760px)',
  ]);
});

test('public four-item navigation never falls into the empty carousel columns', async () => {
  const styles = await read('app/header-foundation.css');

  assert.match(
    styles,
    /nav\[aria-label='Primary navigation'\]:not\(:has\(> button\)\)[\s\S]*?display: flex !important[\s\S]*?justify-content: center !important/,
  );
  assert.match(
    styles,
    /nav\[aria-label='Primary navigation'\]:has\(> button\)[\s\S]*?display: grid !important[\s\S]*?grid-template-columns: 2\.75rem minmax\(0, 1fr\) 2\.75rem !important/,
  );
  assert.match(
    styles,
    /nav\[aria-label='Primary navigation'\][\s\S]*?> div \{[\s\S]*?display: flex !important[\s\S]*?flex-wrap: nowrap !important[\s\S]*?width: min\(100%, 46rem\) !important/,
  );
  assert.match(
    styles,
    /nav\[aria-label='Primary navigation'\][\s\S]*?> div[\s\S]*?> a \{[\s\S]*?flex: 1 1 0 !important[\s\S]*?min-width: 0 !important[\s\S]*?white-space: nowrap !important/,
  );
});

test('761 to 1180 keeps brand and actions above a full-width navigation row', async () => {
  const styles = await read('app/header-foundation.css');
  const compact = styles.slice(
    styles.indexOf('@media (min-width: 761px) and (max-width: 1180px)'),
    styles.indexOf('@media (max-width: 760px)'),
  );

  assert.match(compact, /grid-template-columns: auto minmax\(0, 1fr\) !important/);
  assert.match(compact, /grid-template-areas:[\s\S]*?'brand actions'[\s\S]*?'nav nav' !important/);
  assert.match(compact, /nav\[aria-label='Primary navigation'\][\s\S]*?grid-area: nav !important[\s\S]*?width: 100% !important/);
  assert.match(compact, /> div:last-child \{[\s\S]*?grid-area: actions !important/);
});

test('1181 and wider use intrinsic side content with a flexible middle nav', async () => {
  const styles = await read('app/header-foundation.css');
  const desktop = styles.slice(
    styles.indexOf('@media (min-width: 1181px)'),
    styles.indexOf('@media (min-width: 761px) and (max-width: 1180px)'),
  );

  assert.match(desktop, /grid-template-columns: auto minmax\(0, 1fr\) auto !important/);
  assert.match(desktop, /grid-template-areas: 'brand nav actions' !important/);
  assert.match(desktop, /nav\[aria-label='Primary navigation'\][\s\S]*?width: 100% !important[\s\S]*?justify-self: stretch !important/);
  assert.match(styles, /> div\s*>\s*div:last-child \{[\s\S]*?width: max-content !important[\s\S]*?flex-wrap: nowrap !important/);
});

test('phone header remains one row and does not inherit tablet navigation geometry', async () => {
  const styles = await read('app/header-foundation.css');
  const phone = styles.slice(styles.indexOf('@media (max-width: 760px)'));

  assert.match(phone, /grid-template-areas: 'brand actions' !important/);
  assert.match(phone, /nav\[aria-label='Primary navigation'\][\s\S]*?display: none !important/);
  assert.doesNotMatch(phone, /'nav nav'/);
});
