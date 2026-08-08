import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const helperUrl = new URL("../lib/admin-lifecycle-calculator.ts", import.meta.url);
const source = readFileSync(helperUrl, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: "admin-lifecycle-calculator.ts",
}).outputText;

const moduleRecord = { exports: {} };
const sharedValuationStub = {
  calculateEngineHoursValue() {
    throw new Error("Valuation stub is not used by the finance unit tests.");
  },
  tractorLifetimeHours(type, powerKw) {
    if (type === "orchard") return 10_000;
    if (powerKw <= 25) return 8_000;
    if (powerKw <= 75) return 12_000;
    return 14_000;
  },
};
const localRequire = (specifier) => {
  if (specifier === "./valuation/shared") return sharedValuationStub;
  throw new Error(`Unexpected test import: ${specifier}`);
};

new Function("require", "module", "exports", compiled)(
  localRequire,
  moduleRecord,
  moduleRecord.exports,
);

const calculator = moduleRecord.exports;

function closeTo(actual, expected, tolerance = 0.02) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("R500,000 tractor finance matches the standard amortising-loan result", () => {
  const result = calculator.calculateLoan({
    principal: 500_000,
    annualRatePct: 10.5,
    termMonths: 60,
    balloon: 0,
  });

  closeTo(result.monthlyPayment, 10_746.95);
  closeTo(result.totalRepayment, 644_817.01);
  closeTo(result.totalInterest, 144_817.01);
});

test("R614,000 complete package matches the agreed five-year example", () => {
  const result = calculator.calculateLoan({
    principal: 614_000,
    annualRatePct: 10.5,
    termMonths: 60,
    balloon: 0,
  });

  closeTo(result.monthlyPayment, 13_197.25);
  closeTo(result.totalRepayment, 791_835.29);
  closeTo(result.totalInterest, 177_835.29);
});

test("service plan and uptime reserve expose their standalone finance cost", () => {
  const service = calculator.calculateLoan({
    principal: 64_000,
    annualRatePct: 10.5,
    termMonths: 60,
  });
  const reserve = calculator.calculateLoan({
    principal: 50_000,
    annualRatePct: 10.5,
    termMonths: 60,
  });

  closeTo(service.monthlyPayment, 1_375.61);
  closeTo(service.totalRepayment, 82_536.58);
  closeTo(service.totalInterest, 18_536.58);
  closeTo(reserve.monthlyPayment, 1_074.7);
  closeTo(reserve.totalRepayment, 64_481.7);
  closeTo(reserve.totalInterest, 14_481.7);
});

test("month-36 settlement matches the agreed complete-package example", () => {
  const balance = calculator.calculateRemainingBalance(
    {
      principal: 614_000,
      annualRatePct: 10.5,
      termMonths: 60,
      balloon: 0,
    },
    36,
  );

  closeTo(balance, 284_570.53);
});

test("service and reserve package calculations preserve the default commercial assumptions", () => {
  const service = calculator.calculateServicePlan({
    serviceIntervalHours: 250,
    expectedAnnualHours: 1_000,
    costPerService: 8_000,
    planYears: 2,
    negotiatedAmount: 64_000,
  });
  const reserve = calculator.calculateUptimeReserve({
    mode: "fixed",
    costPerEvent: 4_000,
    eventsPerYear: 4,
    postWarrantyYears: 3,
    fixedAmount: 50_000,
  });

  assert.equal(service.servicesPerYear, 4);
  assert.equal(service.serviceCount, 8);
  assert.equal(service.calculatedAmount, 64_000);
  assert.equal(service.packageAmount, 64_000);
  assert.equal(reserve.eventCount, 12);
  assert.equal(reserve.calculatedAmount, 48_000);
  assert.equal(reserve.packageAmount, 50_000);
});

test("zero-percent finance and balloon values do not divide by zero", () => {
  const result = calculator.calculateLoan({
    principal: 120_000,
    annualRatePct: 0,
    termMonths: 12,
    balloon: 24_000,
  });

  assert.equal(result.monthlyPayment, 8_000);
  assert.equal(result.totalRepayment, 120_000);
  assert.equal(result.totalInterest, 0);
  assert.equal(
    calculator.calculateRemainingBalance(
      {
        principal: 120_000,
        annualRatePct: 0,
        termMonths: 12,
        balloon: 24_000,
      },
      12,
    ),
    24_000,
  );
});

test("settled finance leaves the full trade value as equity", () => {
  assert.equal(calculator.calculateEquity(260_000, 0), 260_000);
});

test("next-cycle allocation funds both maintenance packages before the deposit", () => {
  const result = calculator.calculateNextCycle({
    equity: 260_000,
    nextServicePlan: 64_000,
    nextUptimeReserve: 50_000,
    currentNewPrice: 500_000,
    inflationRatePct: 3,
    years: 5,
  });

  assert.equal(result.remainingDeposit, 146_000);
  assert.equal(result.allocationShortfall, 0);
  closeTo(result.nextTractorPrice, 579_637.04);
});

test("parts inflation is compounded at each event date rather than for five full years", () => {
  const result = calculator.calculateInflatedEventSpend({
    costPerEvent: 4_000,
    eventsPerYear: 4,
    years: 3,
    startAfterYears: 2,
    annualInflationPct: 3,
  });

  assert.ok(result.total > 48_000);
  assert.ok(result.total < 48_000 * 1.03 ** 5);
  assert.equal(result.byYear.length, 3);
});

test("future value delegates to the existing Aim4price valuation helpers", () => {
  assert.match(source, /calculateEngineHoursValue/);
  assert.match(source, /tractorLifetimeHours/);
  assert.doesNotMatch(source, /calculateFuturePriceForAsset/);
});
