import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const client = read('app/my-invoices/my-invoices-client.tsx');
const styles = read('app/my-invoices/page.module.css');
const modalStart = client.indexOf('{recurringOpen ?');
const modalEnd = client.indexOf('{filterOpen ?', modalStart);
const recurringModal = client.slice(modalStart, modalEnd);

test('recurring costs use the compact three-step Spending budget pattern', () => {
  assert.ok(modalStart >= 0 && modalEnd > modalStart, 'recurring cost modal should be present');
  assert.match(client, /type RecurringWizardStep = 1 \| 2 \| 3/);
  assert.match(client, /const \[recurringWizardStep, setRecurringWizardStep\]/);
  assert.match(recurringModal, /\[\['Coverage', 1\], \['Details', 2\], \['Review', 3\]\]/);
  assert.match(recurringModal, /styles\.invoiceDropCodeModal/);
  assert.match(recurringModal, /styles\.budgetWizardModal/);
  assert.match(recurringModal, /styles\.invoiceDropWizardProgress/);
  assert.match(recurringModal, /styles\.invoiceDropWizardPanel/);
  assert.match(recurringModal, /What should this cost cover\?/);
  assert.match(recurringModal, /Set the recurring cost/);
  assert.match(recurringModal, /Review your commitment/);
  assert.match(recurringModal, /onClick=\{continueRecurringWizard\}/);
  assert.match(recurringModal, /goBackRecurringWizard/);
});

test('coverage reuses the complete saved-asset picker with safe draft selection', () => {
  assert.match(recurringModal, /<h2 id="recurring-asset-picker-title">Choose Saved Assets<\/h2>/);
  assert.match(recurringModal, /styles\.budgetAssetPickerModal/);
  assert.match(recurringModal, /styles\.budgetAssetPickerToolbar/);
  assert.match(recurringModal, /recurringPickerAssetIds\.includes\(asset\.id\)/);
  assert.match(recurringModal, /toggleAllFilteredRecurringAssets/);
  assert.match(recurringModal, /Select all shown/);
  assert.match(recurringModal, /confirmRecurringAssetPicker/);
  assert.match(recurringModal, /data-asset-choice-selected=\{isSelected \? 'true' : undefined\}/);
  assert.match(recurringModal, /aria-pressed=\{isSelected\}/);
  assert.match(client, /if \(!query\) return assets/);
  assert.doesNotMatch(recurringModal, /<select[^>]*multiple/);
});

test('each step validates before advancing and save only runs from review', () => {
  assert.match(client, /if \(!recurringAssetIds\.length\)[\s\S]*?Choose at least one saved asset/);
  assert.match(client, /if \(!recurringDraft\.description\.trim\(\)\)/);
  assert.match(client, /recurringAmountValue <= 0/);
  assert.match(client, /recurringDraft\.endDate < recurringDraft\.startDate/);
  assert.match(client, /if \(recurringWizardStep !== 3\)[\s\S]*?continueRecurringWizard\(\)/);
  assert.match(client, /setRecurringWizardStep\(3\)/);
});

test('review preserves the full recurring-cost payload before save', () => {
  for (const label of ['Assets', 'Description', 'Category', 'Amount', 'Frequency', 'Starts', 'Ends', 'Renewal', 'Reference', 'Note']) {
    assert.match(recurringModal, new RegExp(`<dt>${label}<\\/dt>`));
  }
  assert.match(client, /assetIds: recurringAssetIds/);
  assert.match(recurringModal, /Actual paid invoices remain separate in the Cost Ledger/);
});

test('recurring wizard has responsive, purpose-built field and review styling', () => {
  assert.match(styles, /\.recurringWizardModal\s*\{[^}]*width:\s*min\(100%, 860px\)/);
  assert.match(styles, /\.recurringWizardModal\s*\{[^}]*max-height:\s*min\(94dvh, 860px\)/);
  assert.match(styles, /\.recurringWizardModal \.invoiceDropCodeHeader\s*\{[^}]*padding:\s*1\.25rem 1\.5rem 0\.95rem/);
  assert.match(styles, /\.recurringDetailsGrid,[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.recurringDetailsGrid,[\s\S]*?column-gap:\s*1rem/);
  assert.match(styles, /\.recurringFrequencyControl\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.recurringFrequencyControl\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.recurringReviewNotice\s*\{/);
});
