import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ownerLogin = read('app/owner-app/login/owner-app-login-client.tsx');
const dealerLogin = read('app/dealer/login/dealer-login-client.tsx');
const fieldLogin = read('app/field-manager/field-manager-login-client.tsx');
const ownerRoute = read('app/api/owner-app/login/route.ts');
const dealerRoute = read('app/api/dealer/login/route.ts');
const fieldRoute = read('app/api/field-manager/login/route.ts');
const welcome = read('components/AppLoginWelcome.tsx');
const manifest = read('app/dealer/manifest.webmanifest/route.ts');
const dealerLayout = read('app/dealer/layout.tsx');

test('all three apps show the authenticated user and company logo before redirecting', () => {
  for (const client of [ownerLogin, dealerLogin, fieldLogin]) {
    assert.match(client, /<AppLoginWelcome \{\.\.\.welcome\} \/>/);
    assert.match(client, /setWelcome\(\{/);
    assert.match(client, /window\.setTimeout\(\(\) => window\.location\.replace\(redirectTo\), 1400\)/);
  }

  for (const route of [ownerRoute, dealerRoute, fieldRoute]) {
    assert.match(route, /welcome: \{/);
    assert.match(route, /companyName: profile\.businessName \|\| profile\.displayName \|\| profile\.name \|\| 'Aim4price'/);
    assert.match(route, /logoUrl: profile\.logoUrl \|\| '\/icon\.png'/);
  }

  assert.match(welcome, />Welcome<\/span>/);
  assert.match(welcome, /<h1>\{displayName\}<\/h1>/);
  assert.match(welcome, /src=\{logoUrl \|\| '\/icon\.png'\}/);
});

test('Dealer App install metadata uses the dark green white-logo icon set', () => {
  for (const icon of ['dealer-icon-192-dark.png', 'dealer-icon-512-dark.png', 'dealer-apple-touch-icon-dark.png']) {
    assert.match(manifest, new RegExp(icon.replace('.', '\\.')));
    const signature = readFileSync(new URL(`../public/${icon}`, import.meta.url)).subarray(0, 8).toString('hex');
    assert.equal(signature, '89504e470d0a1a0a');
  }
  assert.match(manifest, /theme_color: '#103f34'/);
  assert.match(dealerLayout, /themeColor: '#103f34'/);
  assert.match(dealerLayout, /dealer-icon-512-dark\.png\?v=1/);
});
