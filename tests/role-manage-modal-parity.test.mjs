import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const leadClient = readFileSync(new URL('../app/leads/leads-client.tsx', import.meta.url), 'utf8');
const leadStyles = readFileSync(new URL('../app/leads/page.module.css', import.meta.url), 'utf8');
const trackerClient = readFileSync(new URL('../components/DealerMaintenanceTrackerClient.tsx', import.meta.url), 'utf8');
const trackerStyles = readFileSync(new URL('../components/DealerMaintenanceTrackerClient.module.css', import.meta.url), 'utf8');
const accountantModal = readFileSync(new URL('../components/AccountantAssetManageModal.tsx', import.meta.url), 'utf8');
const ownerStyles = readFileSync(new URL('../app/asset-register/page.module.css', import.meta.url), 'utf8');

const leadManage = leadClient.slice(
  leadClient.indexOf('{managedLead ? ('),
  leadClient.indexOf('{qrLeadAsset ? (', leadClient.indexOf('{managedLead ? (')),
);

const trackerManage = trackerClient.slice(
  trackerClient.indexOf('{managedAsset ? ('),
  trackerClient.indexOf('{filterOpen ? (', trackerClient.indexOf('{managedAsset ? (')),
);

const accountantMenu = accountantModal.slice(
  accountantModal.indexOf("{view === 'menu' ? ("),
  accountantModal.indexOf("{view === 'finance'", accountantModal.indexOf("{view === 'menu' ? (")),
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
  assert.match(leadManage, /assetStyles\.optionDangerButton[^\n]*assetStyles\.ownerCommandDangerAction[^\n]*styles\.accountantDeleteAction/);
  assert.match(accountantModal, /view === 'menu' \? styles\.ownerCommandModal : ''/);
  assert.match(accountantModal, /view === 'menu' \? `\$\{styles\.optionsScrollBody\} \$\{styles\.ownerCommandScrollBody\}`/);
  assert.match(accountantMenu, /styles\.ownerCommandGrid/);
  assert.equal((accountantMenu.match(/styles\.ownerCommandAction/g) || []).length, 5);
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
    assert.match(accountantMenu, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('role manage layouts match the owner 3-2-1 responsive grid', () => {
  const ownerCommandCss = ownerStyles.slice(ownerStyles.indexOf('/* === Owner asset command centre === */'));
  const roleCommandCss = leadStyles.slice(leadStyles.indexOf('/* === Role asset management matches the owner command centre === */'));
  const trackerCommandCss = trackerStyles.slice(trackerStyles.indexOf('/* === Dealer asset management matches the owner command centre === */'));

  for (const css of [ownerCommandCss, roleCommandCss, trackerCommandCss]) {
    assert.match(css, /width:\s*min\(97vw, 84rem\)\s*!important;/);
    assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)\s*!important;/);
    assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)\s*!important;/);
    assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)\s*!important;/);
    assert.match(css, /min-height:\s*6\.25rem\s*!important;/);
    assert.match(css, /white-space:\s*nowrap\s*!important;/);
  }

  assert.match(roleCommandCss, /@media \(min-width: 701px\) and \(max-width: 1180px\)/);
  assert.match(roleCommandCss, /@media \(min-width: 901px\)[\s\S]*?white-space:\s*nowrap\s*!important;/);
  assert.match(roleCommandCss, /@media \(max-width: 700px\)/);
  assert.match(roleCommandCss, /padding:\s*clamp\(1\.35rem, 2\.15vw, 1\.75rem\)\s*!important;/);
  assert.match(roleCommandCss, /padding:\s*0 0 1\.05rem\s*!important;/);
  assert.match(trackerCommandCss, /@media \(min-width: 701px\) and \(max-width: 1180px\)/);
  assert.match(trackerCommandCss, /@media \(min-width: 901px\)[\s\S]*?white-space:\s*nowrap\s*!important;/);
  assert.match(trackerCommandCss, /@media \(max-width: 700px\)/);
  assert.match(trackerCommandCss, /padding:\s*clamp\(1\.35rem, 2\.15vw, 1\.75rem\)\s*!important;/);
  assert.match(trackerCommandCss, /padding:\s*0 0 1\.05rem\s*!important;/);
});

test('accountant subviews keep their form layout outside the owner-style menu', () => {
  assert.match(accountantModal, /view === 'menu' \? styles\.ownerCommandModal : ''/);
  assert.match(accountantModal, /view === 'finance' \? styles\.accountantFinanceModal : ''/);
  assert.doesNotMatch(accountantModal, /styles\.accountantFinanceModal[^\n]*styles\.ownerCommandModal/);
  assert.match(accountantMenu, /styles\.optionDangerButton[^\n]*styles\.ownerCommandDangerAction/);
});
