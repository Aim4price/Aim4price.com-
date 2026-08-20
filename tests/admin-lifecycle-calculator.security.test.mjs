import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const page = read("app/admin/lifecycle-calculator/page.tsx");
const client = read("app/admin/lifecycle-calculator/lifecycle-calculator-client.tsx");
const styles = read("app/admin/lifecycle-calculator/page.module.css");
const route = read("app/api/admin/lifecycle-calculator/export/route.ts");
const report = read("lib/admin-lifecycle-calculator-report.ts");
const calculator = read("lib/admin-lifecycle-calculator.ts");
const access = read("lib/account-access.ts");
const constants = read("lib/account-constants.ts");
const header = read("components/AppHeader.tsx");
const adminUsers = read("app/admin/admin-client.tsx");
const adminDashboard = read("app/admin/dashboard/page.tsx");
const adminNavigation = read("components/AdminNavigation.tsx");

test("the server page blocks rendering until the existing admin guard succeeds", () => {
  assert.match(page, /await requireAdminPageAccess\(\);/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /export const runtime = "nodejs"/);
});

test("the existing exact-email admin model remains in force", () => {
  assert.match(access, /const session = await getAnyServerSession\(\)/);
  assert.match(access, /if \(!session\?\.user\?\.id\)/);
  assert.match(access, /if \(!isAim4priceAdminEmail\(session\.user\.email\)\)/);
  assert.match(constants, /AIM4PRICE_ADMIN_EMAIL = "aim4price@gmail\.com"/);
  assert.match(constants, /normalizeEmail\(value\) === AIM4PRICE_ADMIN_EMAIL/);
  assert.doesNotMatch(access, /account_type\s*===\s*["']admin["']/i);
});

test("the XLSX export endpoint independently enforces authentication and admin email", () => {
  assert.match(route, /const session = await getAnyServerSession\(\)/);
  assert.match(route, /if \(!session\?\.user\?\.id\)[\s\S]*?status: 401/);
  assert.match(route, /if \(!isAim4priceAdminEmail\(session\.user\.email\)\)[\s\S]*?status: 403/);
  assert.match(route, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.match(route, /createXlsxWorkbook/);
});

test("the client contains no account email checks or persisted admin bypass", () => {
  assert.doesNotMatch(client, /aim4price@gmail\.com/);
  assert.doesNotMatch(client, /localStorage.*admin/is);
  assert.match(client, /fetch\("\/api\/admin\/lifecycle-calculator\/export"/);
});

test("normal navigation stays private while all admin navigation links to the model", () => {
  assert.doesNotMatch(header, /\/admin\/lifecycle-calculator/);
  assert.match(adminNavigation, /href: "\/admin\/lifecycle-calculator"/);
  assert.match(page, /<AdminNavigation active="lifecycle" \/>/);
  assert.match(adminUsers, /<AdminNavigation active="accounts" \/>/);
  assert.match(adminDashboard, /<AdminNavigation active="dashboard" \/>/);
});

test("the calculator is a live workspace rather than a gated wizard", () => {
  assert.match(client, /Build the ownership case/);
  assert.match(client, /buildLifecycleWorkspaceModel\(state\.modelInput\)/);
  assert.match(client, /model\.scenarios\.map/);
  assert.match(client, /Standard vs Service Plan vs Service \+ Maintenance/);
  assert.match(client, /Use this structure/);
  assert.doesNotMatch(client, /activeStep/);
  assert.doesNotMatch(client, /hidden=\{/);
  assert.doesNotMatch(client, />Continue</);
  assert.doesNotMatch(client, />View results</);
  assert.match(calculator, /id: "standard"[\s\S]*?id: "service"[\s\S]*?id: "full"/);
});

test("asset assumptions are generic and expose depreciation inputs", () => {
  assert.match(client, /title="Asset & Lifecycle Assumptions"/);
  assert.match(client, /Starting \/ new asset price/);
  assert.match(client, /Usage basis/);
  assert.match(client, /Hours/);
  assert.match(client, /Kilometres/);
  assert.match(client, /Percentage worked/);
  assert.match(client, /Expected useful life/);
  assert.match(client, /Expected condition at disposal/);
  assert.match(client, /CONDITION_OPTIONS\.map/);
  assert.doesNotMatch(client, />Tractor type</);
  assert.doesNotMatch(client, /label="Power"/);
});

test("ownership and finance terms remain independent with automatic calendar years", () => {
  assert.match(client, /updateModel\("ownershipYears", value\)/);
  assert.match(client, /updateModel\("financeTermMonths", value\)/);
  assert.doesNotMatch(client, /termMonths:\s*Math\.max\(1, Math\.round\(years \* 12\)\)/);
  assert.match(client, /Expected disposal year/);
  assert.match(client, /purchaseYear \+ model\.input\.ownershipYears/);
  assert.match(client, /Expected end of payment year/);
  assert.match(client, /purchaseYear \+ Math\.ceil\(model\.input\.financeTermMonths \/ 12\)/);
  assert.match(client, /settlementAtDisposal/);
});

test("service and maintenance are separate editable lifecycle assumptions", () => {
  assert.match(client, /title="Scheduled Service Provision"/);
  assert.match(client, /title="Maintenance & Uptime Provision"/);
  assert.match(client, /label="Service basis"/);
  assert.match(client, /Usage interval/);
  assert.match(client, /Calendar interval/);
  assert.match(client, /Fixed number of services/);
  assert.match(client, /Manual package amount/);
  assert.match(client, /value=\{model\.input\.negotiatedServiceAmount\}/);
  assert.match(client, /value=\{model\.input\.negotiatedMaintenanceReserve\}/);
  assert.match(client, /Enter the amount quoted for this deal/);
  assert.match(client, /Enter the reserve agreed for this ownership period/);
  assert.doesNotMatch(client, /regression example/);
});

test("VAT is explicit for base finance, package finance and refinance", () => {
  assert.match(client, /VAT Included/);
  assert.match(client, /VAT Excluded/);
  assert.match(client, /model\.future\.startingPrice\.netAmount/);
  assert.match(client, /model\.future\.startingPrice\.vatAmount/);
  assert.match(client, /model\.future\.startingPrice\.grossAmount/);
  assert.match(client, /model\.packageVat\[preferred\.id\]\.netAmount/);
  assert.match(client, /originalLoan: preferred\.loanTerms/);
  assert.match(calculator, /newPrice: startingPrice\.netAmount/);
  assert.match(styles, /\.segmentedButtons/);
  assert.match(styles, /\.vatBreakdown/);
});

test("future value, results, equity and next-cycle outputs are first-class sections", () => {
  assert.match(client, /title="Future Asset Position"/);
  assert.match(client, /Age depreciation/);
  assert.match(client, /Usage depreciation/);
  assert.match(client, /Aim4price retail ex VAT/);
  assert.match(client, /title="Annual Cash-Flow Comparison"/);
  assert.match(client, /title="Asset & Equity Position"/);
  assert.match(client, /title="Next Asset Cycle"/);
  assert.match(client, /title="Refinance \/ Cash-Flow Stress Test"/);
  assert.match(client, /title="Sensitivity \/ Stress Testing"/);
});

test("the optional dealer analysis is hidden until enabled", () => {
  assert.match(client, /includeDealerEconomics: false/);
  assert.match(client, /label="Include internal Dealer Economics"/);
  assert.match(client, /state\.includeDealerEconomics \? \(/);
  assert.match(report, /if \(context\.request\.includeDealerEconomics\) sheets\.push\(dealerSheet\(context\)\)/);
});

test("workspace comparison tables and panels adapt to smaller screens and print", () => {
  assert.match(styles, /\.workspace \{/);
  assert.match(styles, /\.answerStrip \{[\s\S]*?grid-template-columns: repeat\(5/);
  assert.match(styles, /\.comparisonWrap \{[\s\S]*?overflow-x: auto/);
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*?\.answerStrip,[\s\S]*?grid-template-columns: 1fr/);
  assert.match(styles, /@media print[\s\S]*?\.headerActions/);
});
