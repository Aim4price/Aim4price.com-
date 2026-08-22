import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(new URL('../app/asset-register/asset-register-client.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8');
const header = readFileSync(new URL('../components/AppHeader.tsx', import.meta.url), 'utf8');
const headerStyles = readFileSync(new URL('../components/AppHeader.module.css', import.meta.url), 'utf8');

test('the card uses the branded document category picker with specific options', () => {
  const panel = client.slice(
    client.indexOf('<div className={styles.assetDocumentsPanel}>'),
    client.indexOf('<div className={styles.assetDetailDivider}', client.indexOf('<div className={styles.assetDocumentsPanel}>')),
  );

  assert.match(panel, /<ModalSelect<AssetDocumentCategory>/);
  assert.match(panel, /options=\{ASSET_DOCUMENT_CATEGORY_OPTIONS\}/);
  assert.match(panel, /showDescriptions=\{false\}/);
  assert.match(panel, /usePortal/);
  assert.match(panel, /styles\.assetDocumentsCardShell/);
  assert.doesNotMatch(panel, /<select/);

  for (const label of [
    'Licence / registration',
    'Insurance policy',
    'Finance agreement',
    'Invoice / proof of purchase',
    'Service / inspection / other',
  ]) {
    assert.match(client, new RegExp(label.replaceAll('/', '\\/')));
  }
});

test('percentage usage is rendered without the word worked', () => {
  const formatter = client.slice(
    client.indexOf('function formatUsagePercent'),
    client.indexOf('function buildAssetUsageValue'),
  );

  assert.match(formatter, /return `\$\{formatted\}%`/);
  assert.doesNotMatch(formatter, /worked/i);
});

test('card detail values truncate on one line and preserve their full value', () => {
  assert.match(styles, /\.assetDetailRow > strong\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(styles, /\.assetDocumentsCardShell\s*\{[\s\S]*?position:\s*relative;/);
  assert.match(client, /<strong title=\{buildAssetUsageValue\(asset\)\}>/);
  assert.match(client, /<strong title=\{conditionLabel\(asset\.condition\) \|\| 'Not provided'\}>/);
});

test('scrollbar drags do not trigger outside-click closing', () => {
  const umbrellaHandler = client.slice(
    client.indexOf('function handleOutsideUmbrellaPointerDown'),
    client.indexOf("document.addEventListener('pointerdown', handleOutsideUmbrellaPointerDown)"),
  );
  const headerHandler = header.slice(
    header.indexOf('function handleDocumentClick'),
    header.indexOf('function handleEscape'),
  );

  assert.match(umbrellaHandler, /if \(isViewportScrollbarInteraction\(event\)\) return;/);
  assert.match(headerHandler, /if \(isViewportScrollbarInteraction\(event\)\)/);
});

test('dropdowns reserve scrollbar space only when content is clipped', () => {
  assert.match(styles, /\.customSelectMenuPortal\s*\{[\s\S]*?scrollbar-gutter:\s*auto !important;/);
  assert.match(headerStyles, /\.accountPopover\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 7rem\);[\s\S]*?scrollbar-gutter:\s*auto;/);
  assert.doesNotMatch(headerStyles, /max-height:\s*min\(36rem, calc\(100dvh - 7rem\)\)/);
});
