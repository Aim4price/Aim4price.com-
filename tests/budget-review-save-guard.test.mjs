import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const client = readFileSync(
  new URL('../app/my-invoices/my-invoices-client.tsx', import.meta.url),
  'utf8',
);

const slice = (start, end) => {
  const startIndex = client.indexOf(start);
  const endIndex = client.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `Expected ${start} before ${end}`);
  return client.slice(startIndex, endIndex);
};

const continueBudgetWizard = slice(
  'function continueBudgetWizard()',
  'function goBackBudgetWizard()',
);
const saveCostBudget = slice(
  'async function saveCostBudget()',
  'function askToDeleteBudget(',
);
const budgetModal = slice('{budgetModalOpen ?', '{budgetDeleteCandidate ?');

test('entering budget Review only advances local wizard state', () => {
  assert.match(continueBudgetWizard, /if \(budgetWizardStep === 2\)/);
  assert.match(continueBudgetWizard, /setBudgetWizardStep\(3\)/);
  assert.doesNotMatch(continueBudgetWizard, /fetch\(|saveCostBudget|\/api\/my-invoices\/budgets/);
});

test('budget persistence is guarded behind the explicit Review save action', () => {
  assert.match(saveCostBudget, /if \(budgetWizardStep !== 3 \|\| budgetSaving\) return;/);
  assert.match(saveCostBudget, /\/api\/my-invoices\/budgets/);
  assert.match(saveCostBudget, /method: editingBudgetId \? 'PATCH' : 'POST'/);

  assert.match(budgetModal, /onSubmit=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.doesNotMatch(budgetModal, /onSubmit=\{saveCostBudget\}/);
  assert.match(
    budgetModal,
    /key="budget-next" type="button"[\s\S]*?onClick=\{continueBudgetWizard\}[\s\S]*?>\s*Next\s*</,
  );
  assert.match(
    budgetModal,
    /key="budget-save" type="button"[\s\S]*?onClick=\{\(\) => void saveCostBudget\(\)\}[\s\S]*?Save budget/,
  );
  assert.doesNotMatch(budgetModal, /type="submit"[\s\S]*?Save budget/);
});

test('wizard steps reset their scroll position without focus-induced jumps', () => {
  for (const bodyRef of [
    'budgetWizardBodyRef',
    'recurringWizardBodyRef',
    'manualCostWizardBodyRef',
    'invoiceDropWizardBodyRef',
  ]) {
    assert.match(client, new RegExp(`${bodyRef}\\.current\\?\\.scrollTo\\(\\{ top: 0, left: 0 \\}\\)`));
  }

  assert.match(client, /budgetWizardStepHeadingRef\.current\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(client, /recurringWizardStepHeadingRef\.current;[\s\S]*?target\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(client, /manualCostWizardStepHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
});
