import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('licensing signup remains a separate pending account role', async () => {
  const [client, profile, completionRoute] = await Promise.all([
    read('app/auth/auth-client.tsx'),
    read('lib/account-profile.ts'),
    read('app/api/account-profile/complete-signup/route.ts'),
  ]);

  assert.match(client, /\{ value: "licensing", label: "Licence renewal expert" \}/);
  assert.match(client, /accountType: signupForm\.accountType/);
  assert.match(client, /saveSignupProfileFallback\([\s\S]*?signupForm\.accountType/);
  assert.match(client, /\/api\/account-profile\/complete-signup/);
  assert.match(profile, /account_type = case[\s\S]*?when \$12 then excluded\.account_type/);
  assert.match(profile, /account_subtype = case[\s\S]*?when \$12 then excluded\.account_subtype/);
  assert.match(completionRoute, /getAnyServerSession/);
  assert.match(completionRoute, /accountStatus !== "pending_payment"/);
  assert.match(completionRoute, /SIGNUP_ACCOUNT_TYPES\.has\(accountType\)/);
  assert.match(completionRoute, /createInitialAccountProfile/);
});

test('licensing workspace exposes only My Leads and Discovery navigation', async () => {
  const header = await read('components/AppHeader.tsx');
  const licensingNav = header.match(/if \(accountType === 'licensing'\) \{\n    return \[([\s\S]*?)\n    \];\n  \}/)?.[1] ?? '';

  assert.match(licensingNav, /label: 'My Leads'/);
  assert.match(licensingNav, /label: 'Discovery'/);
  assert.doesNotMatch(licensingNav, /Home|Get Estimate|Marketplace|Maintenance|Asset Register/);
  assert.match(header, /const LICENSING_ACCOUNT_MENU_ITEMS[\s\S]*?My Leads[\s\S]*?Discovery[\s\S]*?Account/);
  assert.match(header, /if \(accountType === 'licensing'\) \{\n    return items;\n  \}/);
});
