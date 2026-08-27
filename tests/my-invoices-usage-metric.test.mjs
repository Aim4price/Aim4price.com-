import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const backend = read('lib/my-invoices.ts');
const migration = read('database/migrations/95-asset-invoice-usage-metrics.sql');
const client = read('app/my-invoices/my-invoices-client.tsx');

test('Cost Ledger accepts every usage metric offered by manual entry', () => {
  for (const metric of ['none', 'hours', 'km', 'percentage']) {
    assert.match(client, new RegExp(`value: '${metric}'`));
    assert.match(migration, new RegExp(`'${metric}'`));
  }
  assert.match(migration, /asset_invoices_usage_metric_check/);
  assert.match(migration, /usage_metric is null or usage_metric in/);
});

test('runtime schema bootstrap repairs older usage metric constraints', () => {
  const bootstrap = backend.slice(
    backend.indexOf('async function ensureMyInvoiceTables'),
    backend.indexOf('export async function listMyInvoiceDocuments'),
  );

  assert.match(bootstrap, /pg_get_constraintdef/);
  assert.match(bootstrap, /position\('percentage' in usage_metric_constraint\) = 0/);
  assert.match(bootstrap, /drop constraint if exists asset_invoices_usage_metric_check/);
  assert.match(bootstrap, /check \(usage_metric is null or usage_metric in \('none', 'hours', 'km', 'percentage'\)\)/);
});

test('no usage reading is persisted as null for compatibility with older databases', () => {
  const normalizer = backend.slice(
    backend.indexOf('function normalizeInvoiceDraft'),
    backend.indexOf('function splitAmount'),
  );

  assert.match(normalizer, /const usageMetric = normalizeUsageMetric\(input\.usageMetric\)/);
  assert.match(normalizer, /const usageReading = usageMetric === 'none' \? null/);
  assert.match(normalizer, /usageMetric: usageMetric === 'none' \? null : usageMetric/);
});
