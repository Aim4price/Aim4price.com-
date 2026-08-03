import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dealerCss = readFileSync(new URL('../app/dealer/dealer.module.css', import.meta.url), 'utf8');

test('Dealer App keeps wide phones in the large single-column layout', () => {
  assert.match(dealerCss, /@media \(min-width: 540px\) and \(max-width: 767px\)/);
  assert.match(dealerCss, /@media \(min-width: 768px\)/);
  assert.doesNotMatch(dealerCss, /@media \(min-width: 600px\)/);
  assert.match(dealerCss, /\.launcher\s*\{\s*grid-template-columns: 1fr;/);
});

test('Dealer App wide-phone controls and launcher cards use the reference scale', () => {
  assert.match(dealerCss, /--dealer-phone-control-height: 88px;/);
  assert.match(dealerCss, /--dealer-phone-card-height: 176px;/);
  assert.match(dealerCss, /--dealer-phone-copy-size: 1\.18rem;/);
  assert.match(dealerCss, /\.card\s*\{[^}]*font-size: clamp\(2rem, 5\.5vw, 2\.35rem\);/s);
  assert.match(dealerCss, /\.field input\s*\{[^}]*font-size: 1\.25rem;/s);
});

test('Dealer App shared workspaces inherit large phone form and action sizing', () => {
  assert.match(
    dealerCss,
    /\.module :is\(input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\), select\)\s*\{[^}]*min-height: var\(--dealer-phone-control-height\) !important;/s,
  );
  assert.match(
    dealerCss,
    /\.dealerDiscoverySurface \[class\*='primaryButton'\][^}]*min-height: var\(--dealer-phone-control-height\) !important;/s,
  );
  assert.match(
    dealerCss,
    /\.dealerLeadsSurface \[class\*='openLeadButton'\][^}]*min-height: var\(--dealer-phone-control-height\) !important;/s,
  );
  assert.match(
    dealerCss,
    /\.module \[class\*='trackerPage'\] \[class\*='trackerHeaderActions'\] > button[^}]*min-height: var\(--dealer-phone-control-height\) !important;/s,
  );
});
