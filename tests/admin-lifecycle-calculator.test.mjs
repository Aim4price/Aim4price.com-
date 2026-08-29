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
  CONDITION_FACTORS: {
    excellent: 1,
    good: 0.9,
    fair: 0.7,
    used: 0.45,
    serious: 0.25,
  },
  calculateEngineHoursValue(input) {
    const age = Math.max(0, (input.baseYear ?? new Date().getFullYear()) - input.yearModel);
    let ageDepPct = 0;
    if (age >= 1) ageDepPct += 20;
    if (age >= 2) ageDepPct += 15;
    if (age >= 3) ageDepPct += 10;
    if (age >= 4) ageDepPct += (age - 3) * 2.5;
    ageDepPct = Math.min(100, ageDepPct);
    const usageDepPct = Math.min(100, ((input.hours ?? 0) / Math.max(1, input.maxLifetimeHours)) * 100);
    const averageDepPct = Math.round((ageDepPct + usageDepPct) / 2);
    const depreciatedValueExVat = input.replacementPriceExVat * (1 - averageDepPct / 100);
    const conditionAdjustedValueExVat = depreciatedValueExVat * sharedValuationStub.CONDITION_FACTORS[input.condition];
    return {
      ageDepPct,
      usageDepPct,
      averageDepPct,
      depreciatedValueExVat: Math.round(depreciatedValueExVat),
      conditionAdjustedValueExVat: Math.round(conditionAdjustedValueExVat),
      finalValueExVat: Math.round(Math.max(conditionAdjustedValueExVat, input.replacementPriceExVat * 0.05)),
    };
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

function balloonLifecycleModel({
  ownershipYears,
  financeTermMonths = 60,
  balloon = 100_000,
}) {
  return calculator.buildLifecycleWorkspaceModel({
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    purchaseYear: 2026,
    ownershipYears,
    financeTermMonths,
    balloon,
    serviceBasis: "manual",
    negotiatedServiceAmount: 0,
    maintenanceStartAfterYears: 0,
    maintenanceYears: 0,
    maintenanceEventsPerYear: 0,
    negotiatedMaintenanceReserve: 0,
    tradeMode: "manual",
    manualTradeValue: 260_000,
  });
}

test("R500,000 asset finance matches the standard amortising-loan result", () => {
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

test("VAT treatment preserves inclusive prices and adds 15% to exclusive prices", () => {
  const included = calculator.calculateVatSummary(500_000, "included");
  const excluded = calculator.calculateVatSummary(500_000, "excluded");

  assert.equal(included.netAmount, 434_782.61);
  assert.equal(included.vatAmount, 65_217.39);
  assert.equal(included.grossAmount, 500_000);
  assert.equal(excluded.netAmount, 500_000);
  assert.equal(excluded.vatAmount, 75_000);
  assert.equal(excluded.grossAmount, 575_000);
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

test("service and reserve package calculations use the entered deal amounts", () => {
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

test("positive-interest balloon finance matches an independently amortised schedule", () => {
  const result = calculator.calculateLoan({
    principal: 500_000,
    annualRatePct: 10.5,
    termMonths: 60,
    balloon: 100_000,
  });

  closeTo(result.monthlyPayment, 9_472.56);
  closeTo(result.totalRepayment, 668_353.61);
  closeTo(result.totalInterest, 168_353.61);
  closeTo(
    calculator.calculateRemainingBalance(
      {
        principal: 500_000,
        annualRatePct: 10.5,
        termMonths: 60,
        balloon: 100_000,
      },
      36,
    ),
    285_387.97,
  );
  assert.equal(
    calculator.calculateRemainingBalance(
      {
        principal: 500_000,
        annualRatePct: 10.5,
        termMonths: 60,
        balloon: 100_000,
      },
      60,
    ),
    100_000,
  );
});

test("balloon is counted once when disposal matches the finance horizon", () => {
  const model = balloonLifecycleModel({ ownershipYears: 5 });
  const tradeValue = model.future.tradeValue.grossAmount;

  for (const scenario of model.scenarios) {
    const financeCash = scenario.cashFlow.reduce(
      (total, year) => total + year.loanPayments,
      0,
    );

    assert.equal(scenario.settlementAtDisposal, 100_000);
    closeTo(
      financeCash + scenario.settlementAtDisposal,
      scenario.loan.totalRepayment,
      0.1,
    );
    closeTo(
      scenario.netOwnershipCostAfterTrade,
      scenario.loan.totalRepayment - tradeValue,
      0.1,
    );
  }
  assert.equal(model.timeline.at(-1).settlementStandard, 100_000);
});

test("balloon remains in settlement when disposal is before the finance horizon", () => {
  const model = balloonLifecycleModel({ ownershipYears: 4 });
  const standard = model.scenarios[0];
  const financeCash = standard.cashFlow.reduce(
    (total, year) => total + year.loanPayments,
    0,
  );

  closeTo(financeCash, standard.loan.monthlyPayment * 48, 0.1);
  assert.ok(standard.settlementAtDisposal > standard.loan.balloon);
});

test("balloon paid before disposal is not left in settlement or timeline equity", () => {
  const model = balloonLifecycleModel({ ownershipYears: 6 });
  const tradeValue = model.future.tradeValue.grossAmount;

  for (const scenario of model.scenarios) {
    const financeCash = scenario.cashFlow.reduce(
      (total, year) => total + year.loanPayments,
      0,
    );

    assert.equal(scenario.settlementAtDisposal, 0);
    closeTo(financeCash, scenario.loan.totalRepayment, 0.1);
    closeTo(
      scenario.netOwnershipCostAfterTrade,
      scenario.loan.totalRepayment - tradeValue,
      0.1,
    );
  }
  assert.equal(model.timeline.find((year) => year.year === 5).settlementStandard, 0);
  assert.equal(model.timeline.at(-1).settlementStandard, 0);
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
  assert.equal(result.negativeEquityShortfall, 0);
  assert.equal(result.allocationShortfall, 0);
  closeTo(result.nextTractorPrice, 579_637.04);
});

test("next-cycle funding carries negative equity instead of discarding it", () => {
  const result = calculator.calculateNextCycle({
    equity: -50_000,
    nextServicePlan: 64_000,
    nextUptimeReserve: 50_000,
    currentNewPrice: 500_000,
    inflationRatePct: 0,
    years: 5,
  });

  assert.equal(result.remainingDeposit, 0);
  assert.equal(result.negativeEquityShortfall, 50_000);
  assert.equal(result.allocationShortfall, 114_000);
  assert.equal(result.nextFinancedAmount, 664_000);
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

test("future asset value accepts editable lifetime hours and keeps the Aim4price valuation helper", () => {
  assert.match(source, /calculateEngineHoursValue/);
  assert.match(source, /calculateFutureAssetValue/);
  assert.match(source, /configuredLifetimeHours > 0/);
  assert.match(source, /tractorLifetimeHours/);
  assert.doesNotMatch(source, /calculateFuturePriceForAsset/);
});

test("the live workspace calculates all three regression scenarios together", () => {
  const model = calculator.buildLifecycleWorkspaceModel({
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    purchaseYear: 2026,
  });
  const [standard, service, full] = model.scenarios;

  assert.deepEqual(model.scenarios.map((scenario) => scenario.id), ["standard", "service", "full"]);
  assert.equal(standard.loan.principal, 500_000);
  assert.equal(service.loan.principal, 564_000);
  assert.equal(full.loan.principal, 614_000);
  closeTo(standard.loan.monthlyPayment, 10_746.95);
  closeTo(service.loan.monthlyPayment, 12_122.56);
  closeTo(full.loan.monthlyPayment, 13_197.25);
  closeTo(service.additionalMonthlyPayment, 1_375.61);
  closeTo(full.additionalMonthlyPayment - service.additionalMonthlyPayment, 1_074.7);
});

test("VAT-exclusive inputs are grossed once for finance and remain ex-VAT for depreciation", () => {
  const model = calculator.buildLifecycleWorkspaceModel({
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    vatTreatment: "excluded",
    purchaseYear: 2026,
  });

  assert.equal(model.future.startingPrice.netAmount, 500_000);
  assert.equal(model.future.startingPrice.vatAmount, 75_000);
  assert.equal(model.future.startingPrice.grossAmount, 575_000);
  assert.equal(model.service.selected.grossAmount, 73_600);
  assert.equal(model.maintenance.selectedReserve.grossAmount, 57_500);
  assert.equal(model.scenarios[2].loan.principal, 706_100);
  assert.equal(model.packageVat.full.netAmount, 614_000);
  assert.equal(model.packageVat.full.vatAmount, 92_100);
  assert.equal(model.packageVat.full.grossAmount, 706_100);
  assert.equal(model.future.projectedReplacementPrice.netAmount, 579_637.04);
});

test("ownership remains independent from finance term and equity deducts settlement", () => {
  const model = calculator.buildLifecycleWorkspaceModel({
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    purchaseYear: 2026,
    ownershipYears: 4,
    financeTermMonths: 60,
  });

  for (const scenario of model.scenarios) {
    assert.ok(scenario.settlementAtDisposal > 0);
    closeTo(
      scenario.equityAtDisposal,
      model.future.tradeValue.grossAmount - scenario.settlementAtDisposal,
    );
    assert.equal(scenario.loan.termMonths, 60);
  }
});

test("financed service and maintenance are not counted again as operating cash", () => {
  const model = calculator.buildLifecycleWorkspaceModel({
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    deposit: 25_000,
    purchaseYear: 2026,
  });
  const [standard, service, full] = model.scenarios;

  assert.ok(standard.cashFlow.some((year) => year.serviceCashPayments > 0));
  assert.ok(standard.cashFlow.some((year) => year.maintenanceCashPayments > 0));
  assert.ok(service.cashFlow.every((year) => year.serviceCashPayments === 0));
  assert.ok(full.cashFlow.every((year) => year.serviceCashPayments === 0));
  assert.ok(full.cashFlow.every((year) => year.maintenanceCashPayments === 0));
  for (const scenario of model.scenarios) {
    assert.equal(
      scenario.cashFlow.reduce((total, year) => total + year.depositPayment, 0),
      25_000,
    );
  }
});

test("usage basis supports hours, kilometres and percentage worked", () => {
  const hours = calculator.buildLifecycleWorkspaceModel({
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    purchaseYear: 2026,
  });
  const kilometres = calculator.buildLifecycleWorkspaceModel({
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    usageBasis: "kilometres",
    annualUsage: 35_000,
    lifetimeUsage: 350_000,
    purchaseYear: 2026,
  });
  const percentage = calculator.buildLifecycleWorkspaceModel({
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    usageBasis: "percentage",
    startingUsage: 5,
    disposalLifeWorkedPct: 40,
    serviceInterval: 10,
    serviceCoverageYears: 5,
    purchaseYear: 2026,
  });

  assert.equal(hours.usageUnit, "h");
  assert.equal(hours.future.projectedUsage, 5_000);
  assert.equal(kilometres.usageUnit, "km");
  assert.equal(kilometres.future.projectedUsage, 175_000);
  assert.equal(percentage.usageUnit, "%");
  assert.equal(percentage.future.projectedUsage, 40);
  assert.equal(percentage.service.serviceCount, 4);
});

test("service basis supports usage, calendar, count and editable manual amounts", () => {
  const calendar = calculator.buildLifecycleWorkspaceModel({
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    serviceBasis: "calendar",
    serviceCalendarIntervalMonths: 6,
    serviceCoverageYears: 2,
    useNegotiatedServiceAmount: false,
    purchaseYear: 2026,
  });
  const count = calculator.buildLifecycleWorkspaceModel({
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    serviceBasis: "count",
    fixedServiceCount: 3,
    useNegotiatedServiceAmount: false,
    purchaseYear: 2026,
  });
  const manual = calculator.buildLifecycleWorkspaceModel({
    ...calculator.DEFAULT_LIFECYCLE_MODEL_INPUT,
    serviceBasis: "manual",
    negotiatedServiceAmount: 81_250,
    negotiatedMaintenanceReserve: 67_900,
    purchaseYear: 2026,
  });

  assert.equal(calendar.service.serviceCount, 4);
  assert.equal(count.service.serviceCount, 3);
  assert.equal(manual.service.selected.grossAmount, 81_250);
  assert.equal(manual.maintenance.selectedReserve.grossAmount, 67_900);
  assert.equal(manual.scenarios[2].loan.principal, 649_150);
});
