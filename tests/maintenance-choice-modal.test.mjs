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

test('maintenance choice modal uses concise add-asset-style action cards', () => {
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
    '.ownerCommandChoiceAction {',
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
    styles.slice(commandStylesStart, actionStylesStart),
    /\.ownerCommandChoiceModal\s*\{[\s\S]*?width:\s*min\(100%, 740px\) !important;[\s\S]*?border-radius:\s*1\.75rem !important;/,
  );
  assert.match(
    actionStyles,
    /\.ownerCommandChoiceAction strong\s*\{[\s\S]*?font-size:\s*clamp\(1\.18rem, 1\.5vw, 1\.35rem\);/,
  );
  assert.match(
    actionStyles,
    /\.ownerCommandChoiceAction\s*\{[\s\S]*?grid-template-columns:\s*1fr !important;[\s\S]*?grid-template-rows:\s*auto auto !important;[\s\S]*?justify-items:\s*center !important;/,
  );
  assert.match(
    actionStyles,
    /\.ownerCommandChoiceAction\s*>\s*\.buttonIcon\s*\{[\s\S]*?grid-row:\s*1 !important;[\s\S]*?width:\s*3\.2rem !important;[\s\S]*?height:\s*3\.2rem !important;[\s\S]*?padding:\s*0\.82rem !important;/,
  );
  assert.match(
    actionStyles,
    /\.ownerCommandChoiceAction\s*>\s*span\s*\{[\s\S]*?grid-row:\s*2 !important;[\s\S]*?justify-items:\s*center;[\s\S]*?text-align:\s*center;/,
  );
  assert.match(
    actionStyles,
    /\.ownerCommandChoiceAction strong\s*\{[\s\S]*?text-align:\s*center !important;[\s\S]*?text-wrap:\s*balance;/,
  );
  assert.match(
    styles,
    /@media \(max-width:\s*700px\)[\s\S]*?\.ownerCommandChoiceAction\s*\{\s*min-height:\s*7\.35rem;/,
  );
  assert.doesNotMatch(actionStyles, /\.ownerCommandChoiceAction small/);
});
