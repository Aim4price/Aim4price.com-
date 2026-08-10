import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const component = read('components/AppPatternBackground.tsx');
const styles = read('components/AppPatternBackground.module.css');
const rootLayout = read('app/layout.tsx');
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

test('the component renders the complete minimal arc composition', () => {
  assert.equal((component.match(/<CornerArcs/g) ?? []).length, 2);
  assert.equal((component.match(/<DotGrid/g) ?? []).length, 2);
  assert.match(component, /mintCircleLeft/);
  assert.match(component, /mintCircleRight/);
  assert.match(component, /data-app-pattern="minimal-arc"/);
  assert.doesNotMatch(component, /\.(?:png|jpe?g|webp|gif)/i);
  assert.doesNotMatch(styles, /url\(/i);
});

test('the background is responsive, interaction-safe, and uses the Aim4price palette', () => {
  for (const token of ['#fafdfb', '#f7faf8', '#f1f7f3', '#78b99b', '#76b99a', '#a9dcc4']) {
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
  assert.match(styles, /stroke-width:\s*1\.25/);
  assert.match(styles, /\.arcs\s*{[^}]*opacity:\s*0\.18/s);
  assert.match(styles, /\.dotGrid\s*{[^}]*opacity:\s*0\.25/s);
  assert.match(styles, /\.mintCircle\s*{[^}]*opacity:\s*0\.13/s);
  assert.match(styles, /--aim4price-card-shadow:\s*0 10px 30px rgba\(13, 62, 49, 0\.08\)/);
});
