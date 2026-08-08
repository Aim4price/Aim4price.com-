import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const page = read("app/admin/lifecycle-calculator/page.tsx");
const client = read(
  "app/admin/lifecycle-calculator/lifecycle-calculator-client.tsx",
);
const access = read("lib/account-access.ts");
const constants = read("lib/account-constants.ts");
const header = read("components/AppHeader.tsx");
const adminUsers = read("app/admin/admin-client.tsx");
const adminDashboard = read("app/admin/dashboard/page.tsx");

test("the server page blocks rendering until the existing admin guard succeeds", () => {
  assert.match(page, /await requireAdminPageAccess\(\);/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /export const runtime = "nodejs"/);
});

test("logged-out, normal, owner and dealer sessions all use the exact-email server guard", () => {
  assert.match(access, /const session = await getAnyServerSession\(\)/);
  assert.match(
    access,
    /if \(!session\?\.user\?\.id\) \{[\s\S]*?redirect\("\/auth#login"\)/,
  );
  assert.match(
    access,
    /if \(!isAim4priceAdminEmail\(session\.user\.email\)\) \{[\s\S]*?redirect\("\/account"\)/,
  );
  assert.match(
    constants,
    /AIM4PRICE_ADMIN_EMAIL = "aim4price@gmail\.com"/,
  );
  assert.match(
    constants,
    /normalizeEmail\(value\) === AIM4PRICE_ADMIN_EMAIL/,
  );
  assert.doesNotMatch(access, /account_type\s*===\s*["']admin["']/i);
});

test("the calculator does not depend on client-side hiding or an unguarded calculation API", () => {
  assert.doesNotMatch(client, /\/api\/admin\/lifecycle-calculator/);
  assert.doesNotMatch(client, /aim4price@gmail\.com/);
  assert.doesNotMatch(client, /localStorage.*admin/is);
});

test("normal application navigation does not expose the admin-only calculator", () => {
  assert.doesNotMatch(header, /\/admin\/lifecycle-calculator/);
});

test("all existing admin navigation surfaces link to the calculator", () => {
  assert.match(page, /href="\/admin\/lifecycle-calculator"/);
  assert.match(adminUsers, /href="\/admin\/lifecycle-calculator"/);
  assert.match(adminDashboard, /href="\/admin\/lifecycle-calculator"/);
});
