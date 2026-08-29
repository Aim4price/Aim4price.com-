import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function compile(path, localRequire) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: path,
  }).outputText;
  const moduleRecord = { exports: {} };
  new Function("require", "module", "exports", output)(localRequire, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

const conditionFactors = {
  excellent: 1,
  good: 0.9,
  fair: 0.7,
  used: 0.45,
  serious: 0.25,
};

const valuation = {
  CONDITION_FACTORS: conditionFactors,
  tractorLifetimeHours: () => 14_000,
  calculateEngineHoursValue(input) {
    const age = Math.max(0, (input.baseYear ?? 2026) - input.yearModel);
    let ageDepPct = 0;
    if (age >= 1) ageDepPct += 20;
    if (age >= 2) ageDepPct += 15;
    if (age >= 3) ageDepPct += 10;
    if (age >= 4) ageDepPct += (age - 3) * 2.5;
    ageDepPct = Math.min(100, ageDepPct);
    const usageDepPct = Math.min(100, ((input.hours ?? 0) / Math.max(1, input.maxLifetimeHours)) * 100);
    const averageDepPct = Math.round((ageDepPct + usageDepPct) / 2);
    const depreciatedValueExVat = input.replacementPriceExVat * (1 - averageDepPct / 100);
    const conditionAdjustedValueExVat = depreciatedValueExVat * conditionFactors[input.condition];
    return {
      ageDepPct,
      usageDepPct,
      averageDepPct,
      depreciatedValueExVat: Math.round(depreciatedValueExVat),
      conditionAdjustedValueExVat: Math.round(conditionAdjustedValueExVat),
      finalValueExVat: Math.round(Math.max(conditionAdjustedValueExVat, input.replacementPriceExVat * 0.05)),
    };
  },
};

const calculator = compile("lib/admin-lifecycle-calculator.ts", (specifier) => {
  if (specifier === "./valuation/shared") return valuation;
  throw new Error(`Unexpected calculator import: ${specifier}`);
});

const report = compile("lib/admin-lifecycle-calculator-report.ts", (specifier) => {
  if (specifier === "./admin-lifecycle-calculator") return calculator;
  throw new Error(`Unexpected report import: ${specifier}`);
});

const xlsx = compile("lib/simple-xlsx.ts", (specifier) => {
  throw new Error(`Unexpected XLSX import: ${specifier}`);
});

function request(overrides = {}) {
  return {
    modelInput: {
      ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
      purchaseYear: 2026,
    },
    clientName: "Example Client",
    assetDescription: "General asset",
    preferredScenario: "full",
    nextServiceAllocation: 64_000,
    nextMaintenanceAllocation: 50_000,
    refinanceMonth: 36,
    refinanceRatePct: 10.5,
    refinanceTermMonths: 48,
    ...overrides,
  };
}

test("financial model contains the eight required sheets and optional dealer sheet", () => {
  const expected = [
    "Executive Comparison",
    "Assumptions",
    "Finance Comparison",
    "Cash Flow",
    "Asset Value & Equity",
    "Service & Maintenance",
    "Next Asset Cycle",
    "Refinance & Stress",
  ];
  const base = report.buildLifecycleWorkbook(request(), new Date("2026-08-08T12:00:00Z"));
  const dealer = report.buildLifecycleWorkbook(request({ includeDealerEconomics: true }));

  assert.deepEqual(base.map((sheet) => sheet.name), expected);
  assert.equal(dealer.length, 9);
  assert.equal(dealer.at(-1).name, "Dealer Economics");
});

test("report context carries explicit VAT, preferred scenario and model checks", () => {
  const context = report.buildLifecycleReportContext(request({
    modelInput: {
      ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
      vatTreatment: "excluded",
      purchaseYear: 2026,
    },
  }));

  assert.equal(context.preferred.id, "full");
  assert.equal(context.model.future.startingPrice.netAmount, 500_000);
  assert.equal(context.model.future.startingPrice.grossAmount, 575_000);
  assert.equal(context.model.packageVat.full.grossAmount, 706_100);
  assert.ok(context.refinance.settlementAmount > 0);
  assert.deepEqual(context.sensitivity.map((entry) => entry.label), ["Base", "Conservative", "Stress"]);
});

test("finance worksheet uses numeric typed cells and auditable formulas", () => {
  const sheets = report.buildLifecycleWorkbook(request());
  const finance = sheets.find((sheet) => sheet.name === "Finance Comparison");
  const cells = finance.rows.flat();
  const formulaCells = cells.filter((cell) => cell && typeof cell === "object" && "formula" in cell);
  const numericCells = cells.filter((cell) => cell && typeof cell === "object" && typeof cell.value === "number");

  assert.ok(formulaCells.some((cell) => cell.formula.includes("PMT(")));
  assert.ok(formulaCells.some((cell) => cell.formula.includes("MAX(0")));
  assert.ok(numericCells.some((cell) => cell.value === 500_000));
  assert.ok(numericCells.every((cell) => !String(cell.value).startsWith("R ")));
});

test("finance worksheet uses each scenario's effective capped balloon", () => {
  const modelInput = {
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    purchaseYear: 2026,
    balloon: 600_000,
  };
  const context = report.buildLifecycleReportContext(request({ modelInput }));
  const finance = report
    .buildLifecycleWorkbook(request({ modelInput }))
    .find((sheet) => sheet.name === "Finance Comparison");
  const balloonRow = finance.rows.find(
    (row) => row[0]?.value === "Effective balloon / residual",
  );

  assert.deepEqual(
    context.model.scenarios.map((scenario) => scenario.loan.balloon),
    [500_000, 564_000, 600_000],
  );
  assert.deepEqual(
    balloonRow.slice(1).map((cell) => cell.value),
    [500_000, 564_000, 600_000],
  );
});

test("simple XLSX writer creates a valid uncompressed workbook with numeric values", () => {
  const workbook = xlsx.createXlsxWorkbook(report.buildLifecycleWorkbook(request()));
  const raw = workbook.toString("utf8");

  assert.equal(workbook.subarray(0, 2).toString("ascii"), "PK");
  assert.match(raw, /xl\/workbook\.xml/);
  assert.match(raw, /Executive Comparison/);
  assert.match(raw, /<v>500000<\/v>/);
  assert.match(raw, /PMT\(/);
  assert.doesNotMatch(raw, />R 500,000</);
});

test("workbook filename is safe and date stamped", () => {
  assert.equal(
    report.lifecycleWorkbookFileName("A Client / Cape", "", new Date("2026-08-08T12:00:00Z")),
    "Aim4price-Lifecycle-Model-A-Client-Cape-2026-08-08.xlsx",
  );
});
