import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const costClient = read('app/my-invoices/my-invoices-client.tsx');
const costStyles = read('app/my-invoices/page.module.css');
const fuelClient = read('app/fuel/fuel-client.tsx');
const fuelStyles = read('app/fuel/page.module.css');

function ruleBody(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

test('Add asset cost presents every capture action in one vertical column', () => {
  assert.match(costClient, /styles\.costChoiceModal/);
  assert.match(
    ruleBody(costStyles, '.costChoiceModal .sourceChoiceGrid'),
    /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
});

test('Fuel slips stacks its menu actions without changing the add-slip chooser', () => {
  assert.match(fuelClient, /styles\.fuelSlipMenuModal/);
  assert.match(
    ruleBody(fuelStyles, '.fuelSlipFlowBackdrop .fuelSlipMenuModal .sourceChoiceGrid'),
    /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  );
  assert.match(
    ruleBody(fuelStyles, '.fuelSlipFlowBackdrop .fuelSlipChoiceModal .sourceChoiceGrid'),
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
});
