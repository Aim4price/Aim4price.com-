import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const leadClient = readFileSync(new URL('../app/leads/leads-client.tsx', import.meta.url), 'utf8');
const leadStyles = readFileSync(new URL('../app/leads/page.module.css', import.meta.url), 'utf8');
const trackerClient = readFileSync(new URL('../components/DealerMaintenanceTrackerClient.tsx', import.meta.url), 'utf8');
const trackerStyles = readFileSync(new URL('../components/DealerMaintenanceTrackerClient.module.css', import.meta.url), 'utf8');

const ownerStyles = readFileSync(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8');

const leadManage = leadClient.slice(
  leadClient.indexOf('{managedLead ? ('),
  leadClient.indexOf('{qrLeadAsset ? (', leadClient.indexOf('{managedLead ? (')),
);

const trackerManage = trackerClient.slice(
  trackerClient.indexOf('{managedAsset ? ('),
  trackerClient.indexOf('{filterOpen ? (', trackerClient.indexOf('{managedAsset ? (')),
);

test('dealer and shared role manage modals reuse the owner command design', () => {
  for (const className of [
    'ownerCommandOverlay',
    'ownerCommandModal',
    'ownerCommandScrollBody',
    'ownerCommandGrid',
    'ownerCommandAction',
  ]) {
    assert.match(leadManage, new RegExp(`assetStyles\\.${className}`));
    assert.match(trackerManage, new RegExp(`assetStyles\\.${className}`));
  }

  assert.match(leadManage, /actionClassName=\{`\$\{assetStyles\.optionActionButton\} \$\{assetStyles\.ownerCommandAction\}`\}/);

});

test('role manage actions use concise sentence-case descriptions', () => {
  for (const copy of [
    'Message the owner.',
    'Email the owner.',
    'Choose a report.',
    'Copy, print or download.',
    'Add asset photos.',
    'Send for owner approval.',
    'Record an expense for this asset.',
  ]) {
    assert.match(leadManage, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const oldCopy of [
    'Open a WhatsApp message to the owner.',
    'Open an email draft with asset context.',
    'Copy, download or print the asset QR label.',
    'Add photos of this asset.',
    'Send a schedule for the owner to approve.',
    'Upload an invoice or enter a cost manually.',
  ]) {
    assert.doesNotMatch(leadManage, new RegExp(oldCopy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const copy of [
    'Message the owner.',
    'Call the owner.',
    'Email the owner.',
    'Update the schedule.',
    'Download maintenance history.',
    'Download a cost report.',
  ]) {
    assert.match(trackerManage, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const copy of [
    'Manage finance and payments.',
    'Keep book and market values separate.',
    'View or add documents.',
    'Choose and download reports.',
    'Record a sale, loss or transfer.',
  ]) {

  }
});

test('role manage layouts match the owner 3-2-1 responsive grid', () => {
  const ownerCommandCss = ownerStyles.slice(ownerStyles.indexOf('/* === Owner asset command centre === */'));
  const roleCommandCss = leadStyles.slice(leadStyles.indexOf('/* === Role asset management matches the owner command centre === */'));
  const trackerCommandCss = trackerStyles.slice(trackerStyles.indexOf('/* === Dealer asset management matches the owner command centre === */'));

  for (const css of [ownerCommandCss, roleCommandCss, trackerCommandCss]) {
    assert.match(css, /width:\s*min\(calc\(var\(--website-design-vw(?:, 1vw)?\) \* 97\), 84rem\)\s*!important;/);
    assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)\s*!important;/);
    assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)\s*!important;/);
    assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)\s*!important;/);
    assert.match(css, /min-height:\s*6\.25rem\s*!important;/);
    assert.match(css, /white-space:\s*nowrap\s*!important;/);
  }

  assert.match(roleCommandCss, /@media \(min-width: 701px\) and \(max-width: 1180px\)/);
  assert.match(roleCommandCss, /@media \(min-width: 901px\)[\s\S]*?white-space:\s*nowrap\s*!important;/);
  assert.match(roleCommandCss, /@media \(max-width: 700px\)/);
  assert.match(roleCommandCss, /padding:\s*clamp\(1\.35rem, calc\(var\(--website-design-vw(?:, 1vw)?\) \* 2\.15\), 1\.75rem\)\s*!important;/);
  assert.match(roleCommandCss, /padding:\s*0 0 1\.05rem\s*!important;/);
  assert.match(trackerCommandCss, /@media \(min-width: 701px\) and \(max-width: 1180px\)/);
  assert.match(trackerCommandCss, /@media \(min-width: 901px\)[\s\S]*?white-space:\s*nowrap\s*!important;/);
  assert.match(trackerCommandCss, /@media \(max-width: 700px\)/);
  assert.match(trackerCommandCss, /padding:\s*clamp\(1\.35rem, calc\(var\(--website-design-vw(?:, 1vw)?\) \* 2\.15\), 1\.75rem\)\s*!important;/);
  assert.match(trackerCommandCss, /padding:\s*0 0 1\.05rem\s*!important;/);
});
