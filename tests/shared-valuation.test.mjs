import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

import * as dealerAssessment from '../lib/valuation/dealer-assessment.ts';
import * as valuationRules from '../lib/valuation/valuation-rules.ts';

const source = readFileSync(new URL('../lib/valuation/shared.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: 'shared.ts',
}).outputText;

const moduleRecord = { exports: {} };
const localRequire = (specifier) => {
  if (specifier === './dealer-assessment') return dealerAssessment;
  if (specifier === './valuation-rules') return valuationRules;
  throw new Error(`Unexpected shared valuation import: ${specifier}`);
};

new Function('require', 'module', 'exports', compiled)(
  localRequire,
  moduleRecord,
  moduleRecord.exports,
);

const shared = moduleRecord.exports;

function assumptions(overrides = {}) {
  return {
    maxLifetimeUsage: null,
    conditionFactorPercent: null,
    dealerAssessment: null,
    popularityStars: null,
    ...overrides,
  };
}

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `expected ${expected}, received ${actual}`);
}

test('broad condition factors use the stronger retained-value curve', () => {
  assert.deepEqual(shared.CONDITION_FACTORS, {
    excellent: 1,
    good: 0.9,
    fair: 0.7,
    used: 0.45,
    serious: 0.25,
  });
});

test('broad and custom condition remain sensitive to popularity at both extremes', () => {
  assertClose(shared.getValuationConditionFactorOverride('good', assumptions({ popularityStars: 1 })), 0.63);
  assertClose(shared.getValuationConditionFactorOverride('good', assumptions({ popularityStars: 5 })), 1);
  assertClose(shared.getValuationConditionFactorOverride('serious', assumptions({ popularityStars: 1 })), 0.175);
  assertClose(shared.getValuationConditionFactorOverride('serious', assumptions({ popularityStars: 5 })), 0.2875);
  assertClose(shared.getValuationConditionFactorOverride('fair', assumptions({
    conditionFactorPercent: 30,
    popularityStars: 1,
  })), 0.21);
  assertClose(shared.getValuationConditionFactorOverride('excellent', assumptions({
    conditionFactorPercent: 110,
    popularityStars: 5,
  })), 1.1);
});

test('detailed condition replaces broad condition before popularity is applied', () => {
  const dealerCondition = {
    mechanicalCondition: 'poor',
    bodyCondition: 'damaged',
    tyreCondition: 'replacement_required',
    serviceHistory: 'none',
    requiredWork: 'major',
    conditionFactorPercent: 20,
  };
  const factor = shared.getValuationConditionFactorOverride('excellent', assumptions({
    dealerAssessment: dealerCondition,
    popularityStars: 1,
  }));

  assertClose(factor, 0.14);
});

test('the real percentage-used valuation keeps the salvage floor after a strong deduction', () => {
  const result = shared.calculatePercentUsedValue({
    replacementPriceExVat: 800_000,
    percentUsed: 90,
    condition: 'good',
    conditionFactorOverride: 0.14,
  });

  assert.equal(result.baseValueExVat, 80_000);
  assert.equal(result.conditionAdjustedValueExVat, 11_200);
  assert.equal(result.salvageValueExVat, 18_000);
  assert.equal(result.finalValueExVat, 18_000);
  assert.equal(result.isSalvageEstimate, true);
});
