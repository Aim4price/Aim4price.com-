import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const component = read('components/AppPatternBackground.tsx');
const styles = read('components/AppPatternBackground.module.css');
const rootLayout = read('app/layout.tsx');
const assetRegisterStyles = [
  read('app/asset-register/page.module.css'),
  read('app/asset-registers/page.module.css'),
];
const layouts = [
  read('app/owner-app/layout.tsx'),
  read('app/dealer/layout.tsx'),
  read('app/field-manager/layout.tsx'),
];

test('the root layout applies one shared pattern background across every page', () => {
  assert.match(rootLayout, /import AppPatternBackground/);
  assert.match(rootLayout, /<AppPatternBackground>{children}<\/AppPatternBackground>/);

  for (const layout of layouts) {
    assert.doesNotMatch(layout, /import AppPatternBackground/);
    assert.doesNotMatch(layout, /<AppPatternBackground>/);
  }

  assert.match(layouts[1], /className={styles\.patternPageContent}/);
});

test('the component renders a complete vector topographic composition', () => {
  assert.match(component, /function TopographicContours/);
  assert.match(component, /patternUnits="userSpaceOnUse"/);
  assert.ok((component.match(/\n\s*'M/g) ?? []).length >= 16);
  assert.match(component, /data-app-pattern="topographic-contours"/);
  assert.doesNotMatch(component, /CornerArcs|DotGrid|mintCircle/);
  assert.doesNotMatch(component, /\.(?:png|jpe?g|webp|gif)/i);
  assert.doesNotMatch(styles, /\.arcs|\.dotGrid|\.mintCircle/);
});

test('the Asset Register keeps the shared topographic pattern visible', () => {
  for (const assetRegisterStyle of assetRegisterStyles) {
    const pageRules = [...assetRegisterStyle.matchAll(/(?:^|\n)\.page\s*\{([^}]*)\}/g)].map(
      (match) => match[1],
    );

    assert.ok(pageRules.length > 0, 'missing Asset Register page rule');

    for (const pageRule of pageRules) {
      if (/background\s*:/.test(pageRule)) {
        assert.match(pageRule, /background:\s*transparent(?:\s*!important)?;/);
      }
    }
  }
});

test('the background is responsive, interaction-safe, and uses the Aim4price palette', () => {
  for (const token of ['#fbfdfc', '#f7faf8', '#f2f7f4', '#78b99b']) {
    assert.ok(styles.includes(token), `missing ${token}`);
  }
  assert.match(styles, /\.decoration\s*{[^}]*position:\s*fixed/s);
  assert.match(styles, /pointer-events:\s*none/);
  assert.match(styles, /overflow:\s*clip/);
  assert.match(styles, /@supports not \(overflow: clip\)/);
  assert.match(styles, /flex:\s*1 0 auto/);
  assert.match(styles, /min-height:\s*100dvh/);
  assert.match(styles, /env\(safe-area-inset-/);
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /stroke-width:\s*0\.95/);
  assert.match(styles, /\.topography\s*{[^}]*opacity:\s*0\.24/s);
  assert.match(styles, /mask-image:\s*radial-gradient/);
  assert.match(styles, /@media \(prefers-contrast: more\)/);
  assert.match(styles, /--aim4price-card-shadow:\s*0 10px 30px rgba\(13, 62, 49, 0\.08\)/);
  assert.match(styles, /\.content > \*\s*{[^}]*background-color:\s*transparent !important/s);
});
