import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('licensing signup remains a separate pending account role', async () => {
  const [client, profile, partnerAccess, auth, authRoute, signupContext, migration] = await Promise.all([
    read('app/auth/auth-client.tsx'),
    read('lib/account-profile.ts'),
    read('lib/partner-access.ts'),
    read('lib/auth.ts'),
    read('app/api/auth/[...all]/route.ts'),
    read('lib/signup-workspace-context.ts'),
    read('database/migrations/71-licensing-account-role.sql'),
  ]);

  assert.match(client, /\{ value: "licensing", label: "Licence renewal expert" \}/);
  assert.match(client, /accountType: signupForm\.accountType/);
  assert.doesNotMatch(client, /saveSignupProfileFallback|\/api\/account-profile\/complete-signup/);
  assert.match(authRoute, /pathname\.endsWith\("\/sign-up\/email"\)/);
  assert.match(authRoute, /withSignupWorkspaceInput\(signupInput/);
  assert.match(signupContext, /new AsyncLocalStorage<SignupWorkspaceInput>/);
  assert.match(signupContext, /"accountType"/);
  assert.match(signupContext, /signupWorkspaceStorage\.run/);
  assert.match(auth, /readSignupWorkspaceField\(fieldName\)/);
  assert.match(auth, /accountType: readSignupField\(context, "accountType"\)/);
  assert.match(profile, /account_type = case[\s\S]*?when \$12 then excluded\.account_type/);
  assert.match(profile, /account_subtype = case[\s\S]*?when \$12 then excluded\.account_subtype/);
  assert.match(profile, /if \(schemaReady\) \{\n    await ensureAccountRoleSchema\(db\)/);
  assert.match(profile, /account_profiles_account_role_check/);
  assert.match(profile, /account_type = 'licensing'/);
  assert.match(profile, /'licence-renewal-expert', 'fleet-licensing-service'/);
  assert.match(partnerAccess, /if \(schemaReady\) \{\n    await ensurePartnerRoleConstraints\(db\)/);
  assert.match(partnerAccess, /asset_register_access_grants_partner_type_check/);
  assert.match(partnerAccess, /'dealer', 'finance', 'insurance', 'licensing'/);
  assert.match(partnerAccess, /asset_leads_lead_type_check/);
  assert.match(partnerAccess, /'finance', 'insurance', 'replacement_quote', 'license_renewal'/);
  assert.match(migration, /account_profiles_account_role_check/);
  assert.match(migration, /account_type = 'licensing'/);
  assert.match(migration, /account_subtype = 'licence-renewal-expert'/);
  assert.match(migration, /VALIDATE CONSTRAINT account_profiles_account_role_check/);
  assert.match(migration, /asset_register_access_grants_partner_type_check/);
  assert.match(migration, /asset_leads_lead_type_check/);
  assert.match(migration, /Optional repair for one incorrectly created pending account/);
});

test('licensing workspace exposes Home, My Leads and Discovery navigation', async () => {
  const [header, authClient] = await Promise.all([
    read('components/AppHeader.tsx'),
    read('app/auth/auth-client.tsx'),
  ]);
  const licensingNav = header.match(/if \(accountType === 'licensing'\) \{\n    return \[([\s\S]*?)\n    \];\n  \}/)?.[1] ?? '';

  assert.match(licensingNav, /label: 'Home'/);
  assert.match(licensingNav, /key: 'home', href: '\/', label: 'Home'/);
  assert.match(licensingNav, /label: 'My Leads'/);
  assert.match(licensingNav, /label: 'Discovery'/);
  assert.doesNotMatch(licensingNav, /Get Estimate|Marketplace|Maintenance|Asset Register/);
  assert.match(header, /const LICENSING_ACCOUNT_MENU_ITEMS[\s\S]*?Home[\s\S]*?My Leads[\s\S]*?Discovery[\s\S]*?Account/);
  assert.match(header, /if \(accountType === 'licensing'\) \{\n    return items;\n  \}/);
  assert.match(authClient, /accountType === "licensing"[\s\S]*?getAbsoluteUrl\("\/"\)/);
  assert.equal(existsSync(new URL('../app/licensing/page.tsx', import.meta.url)), false);
});
