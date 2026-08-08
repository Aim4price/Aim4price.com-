import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const page = read("app/admin/lifecycle-calculator/page.tsx");
const client = read(
  "app/admin/lifecycle-calculator/lifecycle-calculator-client.tsx",
);
const calculatorStyles = read(
  "app/admin/lifecycle-calculator/page.module.css",
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

test("the calculator uses a guided start-to-results flow", () => {
  for (const label of [
    "Asset",
    "Finance",
    "Service",
    "Maintenance",
    "Depreciation",
    "Results",
  ]) {
    assert.match(client, new RegExp(`label: "${label}"`));
  }

  assert.match(client, /const \[activeStep, setActiveStep\] = useState\(0\)/);
  assert.match(client, /hidden=\{activeStepId !== "results"\}/);
  assert.match(client, /"Continue"/);
  assert.match(client, /"View results"/);
  assert.match(client, /← Back/);
  assert.match(client, /The full result stays separate\./);
  assert.match(client, /id: "asset"[\s\S]*?id: "finance"/);
});

test("progress, actions and result-only panels remain usable across screen sizes", () => {
  assert.match(calculatorStyles, /\.flowSteps \{[\s\S]*?grid-template-columns: repeat\(auto-fit/);
  assert.match(calculatorStyles, /\.flowActions \{[\s\S]*?position: sticky/);
  assert.match(calculatorStyles, /\.calculator \[hidden\] \{[\s\S]*?display: none !important/);
  assert.match(calculatorStyles, /@media \(max-width: 800px\)[\s\S]*?\.flowSteps \{[\s\S]*?display: flex[\s\S]*?overflow-x: auto/);
  assert.match(calculatorStyles, /@media \(max-width: 560px\)[\s\S]*?\.flowActions \{[\s\S]*?grid-template-columns: repeat\(2/);
  assert.match(calculatorStyles, /@media print[\s\S]*?\.flowHeader,[\s\S]*?\.flowActions/);
});

test("finance step uses a dropdown for standard, service and maintenance options", () => {
  assert.match(client, /type FinancePackage = "standard" \| "service" \| "full"/);
  assert.match(client, /label: "Standard finance"/);
  assert.match(client, /label: "Add service plan"/);
  assert.match(client, /label: "Add service \+ maintenance reserve"/);
  assert.match(client, /packageOption: "standard"/);
  assert.match(client, /<span>Finance option<\/span>[\s\S]*?<select[\s\S]*?PACKAGE_OPTIONS\.map/);
  assert.match(client, /step\.id === "service"[\s\S]*?packageOption !== "standard"/);
  assert.match(client, /step\.id === "maintenance"[\s\S]*?packageOption === "full"/);
  assert.match(client, /Service plan included/);
  assert.match(client, /Maintenance reserve included/);
});

test("asset setup removes tractor-specific inputs and exposes lifetime and payment end year", () => {
  assert.match(client, /<h2>Asset<\/h2>/);
  assert.match(client, /label="New asset price"/);
  assert.match(client, /label="Expected lifetime"/);
  assert.match(client, /expectedLifetimeHours: 14_000/);
  assert.match(client, /Expected end-of-payment year/);
  assert.match(client, /Math\.ceil\(state\.termMonths \/ 12\)/);
  assert.match(client, /termMonths: Math\.max\(1, Math\.round\(years \* 12\)\)/);
  assert.doesNotMatch(client, />Tractor type</);
  assert.doesNotMatch(client, /label="Power"/);
});

test("Aim4price depreciation is visible and feeds the default trade and equity result", () => {
  assert.match(client, /import \{ CONDITION_FACTORS \} from "\.\.\/\.\.\/\.\.\/lib\/valuation\/shared"/);
  assert.match(client, /tradeMode: "haircut"/);
  assert.match(client, /const conditionValues = CONDITION_OPTIONS\.map/);
  assert.match(client, /calculateFutureAssetValue/);
  assert.match(client, /lifetimeHours: state\.expectedLifetimeHours/);
  assert.match(client, /condition: option\.id/);
  assert.match(client, /Expected condition after/);
  assert.match(client, /Combined age \+ hours depreciation/);
  assert.match(client, /estimatedRetailValue/);
  assert.match(client, /This estimated retail value feeds the default trade-in calculation and equity result/);
});

test("results are split into focused Owner-style views", () => {
  assert.match(client, /type ResultView = "summary" \| "finance" \| "depreciation" \| "advanced"/);
  assert.match(client, /aria-label="Result sections"/);
  assert.match(client, /\["summary", "Summary"\]/);
  assert.match(client, /\["finance", "Finance"\]/);
  assert.match(client, /\["depreciation", "Depreciation & trade"\]/);
  assert.match(client, /\["advanced", "Advanced"\]/);
  assert.match(calculatorStyles, /\.resultTabs \{/);
  assert.match(calculatorStyles, /\.resultSnapshot \{/);
});

test("dealer economics is optional and excluded from results unless selected", () => {
  assert.match(client, /const \[includeDealerEconomics, setIncludeDealerEconomics\] = useState\(false\)/);
  assert.match(client, /label="Include dealer economics"/);
  assert.match(client, /!includeDealerEconomics \|\|/);
});
