import test from 'node:test';
import assert from 'node:assert/strict';
import { adminRetainers, clientCount, hostingEstimate, ownerHosting, rand } from '../lib/hosting-pricing.ts';

test('ten small clients add R247.50 to dealer hosting, not full Owner fees', () => {
  const result = hostingEstimate('dealer', 'monthly', 0, [10, 0, 0], -1);
  assert.equal(result.base, 19900);
  assert.equal(result.clientHosting, 24750);
  assert.equal(result.monthlyTotal, 44650);
});
test('annual hosting is not combined with a single month of admin', () => {
  const result = hostingEstimate('business', 'annually', 0, [10, 1, 2], 1);
  assert.equal(result.clientHosting, 10 * 24975 + 49975 + 2 * 99975);
  assert.equal(result.hosting, result.clientHosting + 199900);
  assert.equal(result.admin, 89900);
  assert.equal(result.monthlyTotal, null);
});
test('all bands use exact quarter-price amounts without rounding away cents', () => {
  for (const period of ['monthly', 'annually']) {
    ownerHosting.forEach((band, index) => {
      const clients = [0, 0, 0]; clients[index] = 1;
      assert.equal(hostingEstimate('dealer', period, 0, clients, -1).clientHosting, band[period] / 4);
    });
  }
  assert.equal(rand(2475), 'R24.75');
  assert.equal(rand(24975), 'R249.75');
});
test('switching account ignores client counts for Owner and free Middleman access', () => {
  assert.equal(hostingEstimate('owner', 'monthly', 1, [12, 4, 2], 0).monthlyTotal, 19900 + 39900);
  const free = hostingEstimate('middleman', 'monthly', 3, [12, 4, 2], -1);
  assert.equal(free.monthlyTotal, 0);
  assert.equal(free.customOwner, false);
});
test('custom Owner hosting remains quote-only and retains optional admin separately', () => {
  const result = hostingEstimate('owner', 'monthly', 3, [0, 0, 0], 2);
  assert.equal(result.customOwner, true);
  assert.equal(result.admin, 159900);
});
test('invalid, fractional and excessive client counts cannot generate negative or non-finite totals', () => {
  assert.equal(clientCount(''), 0);
  assert.equal(clientCount('-4'), 0);
  assert.equal(clientCount('1.9'), 1);
  assert.equal(clientCount('Infinity'), 0);
  assert.equal(clientCount('999999999'), 10000);
  assert.equal(clientCount('no'), 0);
  assert.equal(hostingEstimate('business', 'monthly', 0, [-10, NaN, Infinity], -1).clientHosting, 0);
});
test('each retainer is charged monthly at the agreed fee', () => {
  assert.deepEqual(adminRetainers.map(p => [p.hours, p.cents]), [[2, 39900], [5, 89900], [10, 159900]]);
  assert.equal(hostingEstimate('owner', 'monthly', 0, [], 1).monthlyTotal, 99800);
});


test('pricing links resolve to the three current choices, including legacy URLs', async () => {
  const { pricingAudience } = await import('../lib/subscription-options.ts');
  for (const [input, expected] of [
    ['owner', 'owner'], ['business', 'business'], ['paid-business', 'business'],
    ['free-business', 'free-business'], ['dealer', 'business'], ['middleman', 'free-business'],
    [undefined, null], ['unknown', null],
  ]) assert.equal(pricingAudience(input), expected);
});
