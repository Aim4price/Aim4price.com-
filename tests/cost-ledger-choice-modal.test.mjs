import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const costClient = read('app/my-invoices/my-invoices-client.tsx');
const costStyles = read('app/my-invoices/page.module.css');

test('Add Cost mirrors the compact Fuel Slip choice modal design', () => {
  const modalStart = costClient.indexOf('{sourceChoiceOpen ? (');
  const modalEnd = costClient.indexOf('{recurringOpen && !recurringAssetPickerOpen', modalStart);
  const modalMarkup = costClient.slice(modalStart, modalEnd);
  const modalStyles = costStyles.slice(
    costStyles.indexOf('/* Add Cost uses the same compact choice pattern as Fuel Slips. */'),
  );

  assert.match(modalMarkup, /data-cost-choice-modal="true"/);
  assert.equal((modalMarkup.match(/styles\.costChoiceOption/g) ?? []).length, 3);
  assert.equal((modalMarkup.match(/styles\.costChoiceArrow/g) ?? []).length, 3);
  assert.match(modalMarkup, /Choose how to capture a cost for/);
  assert.doesNotMatch(modalMarkup, /<br\s*\/?\s*>/);

  assert.match(modalStyles, /width: min\(100%, 1120px\)/);
  assert.match(modalStyles, /grid-template-columns: 4\.1rem minmax\(0, 1fr\) 1\.75rem/);
  assert.match(modalStyles, /@media \(min-width: 1180px\)/);
  assert.match(modalStyles, /white-space: nowrap/);
  assert.match(modalStyles, /@media \(max-width: 900px\)/);
  assert.match(modalStyles, /grid-template-columns: 1fr/);
});
