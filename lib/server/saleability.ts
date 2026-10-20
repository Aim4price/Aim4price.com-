import 'server-only';
import type { SaleabilityRefinementAnswers } from '../saleability';
import {
  saleabilityBasis, saleabilityContext, validCurrentSaleabilityAnswers,
  type SaleabilityAsset, type SaleabilityContext, type SaleabilityQuote, type SavedSaleability,
} from '../asset-saleability';

// The repository is public. Production policy lives only in server configuration.
// This bounded data interpreter accepts arithmetic and predicates, never code.
type Scalar = number | string | boolean;
function evaluate(expression: unknown, inputs: Record<string, unknown>, budget: {remaining: number}, depth = 0): Scalar {
  if (--budget.remaining < 0 || depth > 40) throw Error('Invalid pricing configuration.');
  if (typeof expression === 'number' || typeof expression === 'string' || typeof expression === 'boolean') return expression;
  if (!expression || typeof expression !== 'object' || Array.isArray(expression)) throw Error('Invalid pricing configuration.');
  const node = expression as Record<string, unknown>;
  if (typeof node.get === 'string') {
    let value: unknown = inputs;
    for (const key of node.get.split('.')) {
      if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, key)) return '';
      value = (value as Record<string, unknown>)[key];
    }
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
    return '';
  }
  if (Array.isArray(node.cases)) {
    for (const entry of node.cases) {
      if (!entry || typeof entry !== 'object') throw Error('Invalid pricing configuration.');
      if (evaluate(entry.when, inputs, budget, depth + 1) === true) return evaluate(entry.then, inputs, budget, depth + 1);
    }
    return evaluate(node.otherwise, inputs, budget, depth + 1);
  }
  if (!Array.isArray(node.args) || node.args.length < 1 || node.args.length > 100) throw Error('Invalid pricing configuration.');
  const args = node.args.map(arg => evaluate(arg, inputs, budget, depth + 1));
  if (node.op === 'eq') return args.length === 2 && args[0] === args[1];
  if (node.op === 'contains') return args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'string' && args[0].toLowerCase().includes(args[1].toLowerCase());
  if (node.op === 'any') return args.some(arg => arg === true);
  if (node.op === 'all') return args.every(arg => arg === true);
  if (!args.every(arg => typeof arg === 'number' && Number.isFinite(arg))) throw Error('Invalid pricing configuration.');
  const numbers = args as number[];
  if (node.op === 'add') return numbers.reduce((a, b) => a + b, 0);
  if (node.op === 'multiply') return numbers.reduce((a, b) => a * b, 1);
  if (node.op === 'subtract' && numbers.length === 2) return numbers[0] - numbers[1];
  if (node.op === 'max') return Math.max(...numbers);
  if (node.op === 'min') return Math.min(...numbers);
  throw Error('Invalid pricing configuration.');
}

function calculatePrivatePrice(value: number, answers: SaleabilityRefinementAnswers, context: SaleabilityContext) {
  const rawPolicy = process.env.SALEABILITY_POLICY_JSON;
  if (!rawPolicy || rawPolicy.length > 50000) throw Error('Saleability is temporarily unavailable.');
  const policy = JSON.parse(rawPolicy);
  if (!policy || typeof policy.version !== 'string' || !/^[a-zA-Z0-9._-]{1,60}$/.test(policy.version)
    || !Array.isArray(policy.steps) || policy.steps.length > 30) throw Error('Invalid pricing configuration.');
  const steps: Record<string, Scalar> = Object.create(null);
  const inputs = {value, answers, context, steps};
  const budget = {remaining: 5000};
  for (const step of policy.steps) {
    if (!step || typeof step.name !== 'string' || !/^[a-zA-Z0-9_]{1,40}$/.test(step.name)) throw Error('Invalid pricing configuration.');
    steps[step.name] = evaluate(step.expression, inputs, budget);
  }
  const result = evaluate(policy.result, inputs, budget);
  if (typeof result !== 'number' || !Number.isFinite(result) || result <= 0 || result > 1e13) throw Error('Invalid pricing result.');
  return {raw: result, version: policy.version};
}

export function quoteSaleability(valueExVat: number, answers: SaleabilityRefinementAnswers, context: SaleabilityContext = {}): SaleabilityQuote {
  if (!validCurrentSaleabilityAnswers(answers) || !Number.isFinite(valueExVat) || valueExVat <= 0 || valueExVat > 1e12) {
    throw new Error('Complete the selling questions and enter a valid asset value.');
  }
  const {raw, version} = calculatePrivatePrice(valueExVat, answers, context);
  const increment = raw >= 100000 ? 1000 : raw >= 10000 ? 500 : raw >= 1000 ? 100 : raw >= 100 ? 10 : 0.01;
  const priceExVat = Math.round(Math.max(increment, Math.round(raw / increment) * increment) * 100) / 100;
  const resultLabel = answers.sellingRoute === 'dealer' ? 'Estimated dealer offer'
    : answers.sellingRoute === 'auction' ? 'Estimated auction price' : 'Estimated selling price';
  return { priceExVat, resultLabel, modelVersion: version };
}

export function assessSaleability(asset: SaleabilityAsset, answers: SaleabilityRefinementAnswers): SavedSaleability {
  const quote = quoteSaleability(asset.value, answers, saleabilityContext(asset));
  return {
    ...quote,
    // Retain the historical storage contract without inventing a confidence range.
    lowExVat: quote.priceExVat, highExVat: quote.priceExVat,
    assessedAt: new Date().toISOString(), basis: saleabilityBasis(asset), answers,
  };
}
