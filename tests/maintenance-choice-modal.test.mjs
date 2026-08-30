import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(
  new URL('../app/asset-register/asset-register-client.tsx', import.meta.url),
  'utf8',
);
const styles = readFileSync(
  new URL('../app/asset-register/page.module.css', import.meta.url),
  'utf8',
);

test('maintenance choice modal uses concise, larger action labels', () => {
  const modalStart = client.indexOf('styles.ownerCommandChoiceOverlay');
  const modalEnd = client.indexOf(
    '{activeAsset && isDealerTrackingSettingsOpen',
    modalStart,
  );
  const modal = client.slice(modalStart, modalEnd);

  assert.ok(modalStart >= 0 && modalEnd > modalStart, 'expected maintenance choice modal');
  assert.match(modal, /<strong>Add maintenance<\/strong>/);
  assert.match(modal, /<strong>Manage maintenance<\/strong>/);
  assert.match(modal, /<strong>Dealer tracking settings<\/strong>/);
  assert.doesNotMatch(modal, /<small>/);
  assert.doesNotMatch(
    modal,
    /Create a maintenance record|Open this asset|Review dealer maintenance access/,
  );

  const commandStylesStart = styles.indexOf('/* === Owner asset command centre === */');
  const actionStylesStart = styles.indexOf(
    '.ownerCommandChoiceAction > span {',
    commandStylesStart,
  );
  const actionStylesEnd = styles.indexOf(
    '.ownerMarketplaceRemoveButton',
    actionStylesStart,
  );
  const actionStyles = styles.slice(actionStylesStart, actionStylesEnd);

  assert.ok(
    commandStylesStart >= 0 && actionStylesStart >= 0 && actionStylesEnd > actionStylesStart,
    'expected maintenance choice action styles',
  );
  assert.match(
    actionStyles,
    /\.ownerCommandChoiceAction strong\s*\{[\s\S]*?font-size:\s*clamp\(1\.18rem, 1\.5vw, 1\.35rem\);/,
  );
  assert.doesNotMatch(actionStyles, /\.ownerCommandChoiceAction small/);
});
