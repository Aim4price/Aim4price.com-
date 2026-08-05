import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const fieldOverview = read('app/field-manager/field-manager-overview-client.tsx');
const ownerOverview = read('app/owner-app/attention/owner-attention-client.tsx');
const locationGate = read('app/field-manager/field-manager-location-gate.tsx');
const fieldStyles = read('app/field-manager/page.module.css');

test('Field Manager Overview keeps the Owner Overview search and empty-state behaviour', () => {
  for (const source of [fieldOverview, ownerOverview]) {
    assert.match(source, /const \[searchQuery, setSearchQuery\] = useState\(''\)/);
    assert.match(source, /className=\{styles\.overviewSearch\}/);
    assert.match(source, /placeholder="Search assets or maintenance"/);
    assert.match(source, /No matching items need attention\./);
    assert.match(source, /No matching upcoming items\./);
  }
});

test('Field Manager Overview uses the Owner Overview alignment, width and typography', () => {
  assert.match(fieldStyles, /\.overviewPage \{\s*background: #ffffff;/);
  assert.match(fieldStyles, /\.overviewPage \.overviewShell \{\s*width: min\(calc\(100% - var\(--field-page-gutter\)\), 560px\);/);
  assert.match(fieldStyles, /\.overviewPage \.overviewIntro \{[\s\S]*?justify-items: start;[\s\S]*?text-align: left;/);
  assert.match(fieldStyles, /\.overviewPage \.overviewIntro h1 \{[\s\S]*?font-size: clamp\(1\.9rem, 8vw, 2\.45rem\);[\s\S]*?font-weight: 900;/);
  assert.match(fieldStyles, /\.overviewPage \.overviewCard h3 \{[\s\S]*?font-size: clamp\(1\.16rem, 4\.8vw, 1\.38rem\);/);
});

test('scheduled Owner maintenance uses the same compact service location gate', () => {
  assert.match(fieldOverview, /import FieldManagerLocationGate from '.\/field-manager-location-gate'/);
  assert.match(fieldOverview, /<FieldManagerLocationGate/);
  assert.match(ownerOverview, /import ServiceLocationGate from '..\/..\/field-manager\/field-manager-location-gate'/);
  assert.match(ownerOverview, /item\.type !== 'service' && item\.type !== 'checkup'/);
  assert.match(ownerOverview, /publicAssetCode/);
  assert.match(ownerOverview, /<ServiceLocationGate/);
  assert.match(locationGate, /Allow Aim4price to tag this service with your current location\./);
  assert.match(locationGate, /<h2 id="location-gate-title">Location required<\/h2>/);
  assert.match(locationGate, /locationState === 'error'\s*\? 'Retry'/);
  assert.match(locationGate, />\s*Back\s*<\/button>/);
  assert.doesNotMatch(locationGate, /Ready to start service\?|Retry location|locationGateEyebrow/);
  assert.doesNotMatch(locationGate, /Back to overview|Aim4price needs your current location before this service can open/);
  assert.match(fieldStyles, /\.locationGateActions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});
