import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const scanClient = read('app/scan/[publicAssetCode]/scan-client.tsx');
const scanStyles = read('app/scan/[publicAssetCode]/page.module.css');
const dealerClient = read('components/DealerMaintenanceTrackerClient.tsx');
const dealerStyles = read('components/DealerMaintenanceTrackerClient.module.css');

test('Owner and Field Manager show service success before returning to Maintenance', () => {
  assert.match(scanClient, /FIELD_MANAGER_RETURN_DELAY_MS = 2600/);
  assert.match(scanClient, /setDoneMessage\([\s\S]*?Returning to Maintenance…/);
  assert.match(scanClient, /activeEditor === "service"[\s\S]*?"Service saved successfully\."/);
  assert.match(scanClient, /className=\{styles\.thankYouScreen\} role="status" aria-live="polite"/);
  assert.match(scanClient, /Back to Maintenance/);
  assert.match(scanStyles, /\.thankYouIcon/);
  assert.match(scanStyles, /\.thankYouReturn/);
});

test('Dealer shows the same explicit service confirmation and returns to Maintenance', () => {
  assert.match(dealerClient, /const \[serviceSuccess, setServiceSuccess\]/);
  assert.match(dealerClient, /setServiceSuccess\(\{/);
  assert.match(dealerClient, /setServiceSuccess\(null\), 2600/);
  assert.match(dealerClient, /Thank you\./);
  assert.match(dealerClient, /Returning to Maintenance…/);
  assert.match(dealerClient, /Back to Maintenance/);
  assert.match(dealerStyles, /\.serviceSuccessOverlay/);
  assert.match(dealerStyles, /\.serviceSuccessCard/);
});
