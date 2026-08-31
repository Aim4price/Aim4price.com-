import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const component = read('components/AppPatternBackground.tsx');
const styles = read('components/AppPatternBackground.module.css');
const rootLayout = read('app/layout.tsx');
const artworkPath = new URL(
  '../public/brand/aim4price-network-background.png',
  import.meta.url,
);

test('the root layout applies one shared background across every page', () => {
  assert.match(rootLayout, /import AppPatternBackground/);
  assert.match(rootLayout, /<AppPatternBackground>{children}<\/AppPatternBackground>/);
});

test('the component renders the supplied network artwork as decoration', () => {
  assert.ok(existsSync(artworkPath), 'missing network background artwork');
  assert.match(component, /data-app-pattern="network-wave"/);
  assert.match(component, /<div className={styles\.decoration} aria-hidden="true">/);
  assert.match(component, /styles\.networkArtwork/);
  assert.match(component, /styles\.centerWash/);
  assert.doesNotMatch(component, /CornerArcs|DotGrid|minimal-arc/);
  assert.match(
    styles,
    /background-image:\s*url\('\/brand\/aim4price-network-background\.png'\)/,
  );
});

test('the network background remains behind interactions and readable surfaces', () => {
  assert.match(styles, /\.decoration\s*{[^}]*position:\s*fixed/s);
  assert.match(styles, /\.decoration\s*{[^}]*z-index:\s*0/s);
  assert.match(styles, /pointer-events:\s*none/);
  assert.match(styles, /\.content\s*{[^}]*position:\s*relative[^}]*z-index:\s*1/s);
  assert.match(styles, /overflow:\s*clip/);
  assert.match(styles, /@supports not \(overflow: clip\)/);
  assert.match(styles, /flex:\s*1 0 auto/);
  assert.match(styles, /min-height:\s*100dvh/);
  assert.match(styles, /\.content > \*\s*{[^}]*background-color:\s*transparent !important/s);
  assert.match(
    styles,
    /\.content > :global\(\.adminWorkspaceRoot\) > \*\s*{[^}]*background-color:\s*transparent !important/s,
  );
});

test('the network treatment adapts for compact, forced-color and print output', () => {
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*?\.decoration\s*{[^}]*display:\s*none/s);
  assert.match(styles, /@media print[\s\S]*?\.background\s*{[^}]*background:\s*#ffffff/s);
  assert.match(styles, /@media print[\s\S]*?\.decoration\s*{[^}]*display:\s*none/s);
  assert.match(styles, /--aim4price-card-shadow:\s*0 10px 30px rgba\(13, 62, 49, 0\.08\)/);
});
