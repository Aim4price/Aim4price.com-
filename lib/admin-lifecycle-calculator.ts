import type { ConditionKey, TractorType } from "./tractor-data";
import {
  CONDITION_FACTORS,
  calculateEngineHoursValue,
  tractorLifetimeHours,
} from "./valuation/shared";

export type LoanTerms = {
  principal: number;
  annualRatePct: number;
  termMonths: number;
  balloon?: number;
};

export type VatTreatment = "included" | "excluded";

export type VatSummary = {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
};

export type LoanSummary = {
  principal: number;
  monthlyRate: number;
  termMonths: number;
  balloon: number;
  monthlyPayment: number;
  totalRepayment: number;
  totalInterest: number;
};

export type ServicePlanInput = {
  serviceIntervalHours: number;
  expectedAnnualHours: number;
  costPerService: number;
  planYears: number;
  negotiatedAmount?: number | null;
};

export type ServicePlanSummary = {
  servicesPerYear: number;
  serviceCount: number;
  calculatedAmount: number;
  packageAmount: number;
};

export type UptimeReserveInput = {
  mode: "calculated" | "fixed";
  costPerEvent: number;
  eventsPerYear: number;
  postWarrantyYears: number;
  fixedAmount?: number | null;
};

export type UptimeReserveSummary = {
  eventCount: number;
  calculatedAmount: number;
  packageAmount: number;
};

export type FutureValueInput = {
  newPrice: number;
  purchaseYear: number;
  targetYear: number;
  startingHours: number;
  expectedAnnualHours: number;
  lifetimeHours?: number;
  tractorType?: TractorType;
  powerKw?: number;
  condition: ConditionKey;
  inflationRatePct: number;
};

export type FutureValueSummary = {
  yearsForward: number;
  expectedHours: number;
  lifetimeHours: number;
  projectedReplacementPrice: number;
  ageDepreciationPct: number;
  usageDepreciationPct: number;
  averageDepreciationPct: number;
  conditionFactor: number;
  valueBeforeCondition: number;
  conditionAdjustedValue: number;
  estimatedRetailValue: number;
};

export type TradeMode = "manual" | "haircut" | "dealer";

export type TradeValueInput = {
  mode: TradeMode;
  projectedRetailValue: number;
  manualValue: number;
  haircutPct: number;
  dealerOffer: number;
};

export type TradeValueSummary = {
  tradeValue: number;
  haircutAmount: number;
  haircutPct: number;
};

export type RefinanceInput = {
  originalLoan: LoanTerms;
  refinanceMonth: number;
  newAnnualRatePct: number;
  newTermMonths: number;
  newBalloon?: number;
};

export type RefinanceSummary = {
  settlementAmount: number;
  currentMonthlyPayment: number;
  newMonthlyPayment: number;
  monthlyRelief: number;
  originalTotalRepayment: number;
  restructuredTotalRepayment: number;
  newTotalFinanceCost: number;
  additionalCost: number;
};

export type TimelineRow = {
  year: number;
  hours: number;
  replacementPrice: number;
  estimatedRetailValue: number;
  tradeValue: number;
  loanBalance: number;
  equity: number;
  plannedMaintenance: number;
};

export type CashFlowYear = {
  year: number;
  loanPayments: number;
  serviceCashPayments: number;
  maintenanceCashPayments: number;
  totalAnnualCash: number;
  cumulativeCash: number;
};

export type CashFlowScenario = {
  id: "tractor" | "service" | "full";
  label: string;
  description: string;
  loan: LoanSummary;
  years: CashFlowYear[];
  totalCashRequirement: number;
};

export type DealerEconomicsInput = {
  tradeAllowance: number;
  expectedResalePrice: number;
  reconCost: number;
  holdingCost: number;
  servicePlanRevenue: number;
  uptimeReserveRevenue: number;
  grossMarginPct: number;
  newTractorGrossProfit: number;
  riskReserve: number;
};

export type DealerEconomicsSummary = {
  tradeContribution: number;
  servicePartsContribution: number;
  newTractorContribution: number;
  totalGrossContribution: number;
  riskReserve: number;
  commercialBuffer: number;
};

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegative(value: number): number {
  return Math.max(0, finite(value));
}

export function roundCurrency(value: number): number {
  return Math.round((finite(value) + Number.EPSILON) * 100) / 100;
}

export function calculateVatSummary(
  amount: number,
  treatment: VatTreatment,
  vatRatePct = 15,
): VatSummary {
  const enteredAmount = nonNegative(amount);
  const rate = nonNegative(vatRatePct) / 100;
  const grossAmount =
    treatment === "excluded" ? enteredAmount * (1 + rate) : enteredAmount;
  const netAmount =
    treatment === "included" && rate > 0
      ? enteredAmount / (1 + rate)
      : enteredAmount;

  return {
    netAmount: roundCurrency(netAmount),
    vatAmount: roundCurrency(grossAmount - netAmount),
    grossAmount: roundCurrency(grossAmount),
  };
}

function monthlyPaymentRaw(input: {
  principal: number;
  monthlyRate: number;
  termMonths: number;
  balloon: number;
}): number {
  if (input.principal <= 0) return 0;
  if (input.monthlyRate === 0) {
    return (input.principal - input.balloon) / input.termMonths;
  }

  const balloonPresentValue =
    input.balloon / Math.pow(1 + input.monthlyRate, input.termMonths);
  return (
    (input.principal - balloonPresentValue) *
    (input.monthlyRate /
      (1 - Math.pow(1 + input.monthlyRate, -input.termMonths)))
  );
}

export function calculateLoan(input: LoanTerms): LoanSummary {
  const principal = nonNegative(input.principal);
  const termMonths = Math.max(1, Math.round(finite(input.termMonths, 1)));
  const annualRatePct = nonNegative(input.annualRatePct);
  const monthlyRate = annualRatePct / 12 / 100;
  const balloon = Math.min(principal, nonNegative(input.balloon ?? 0));

  const monthlyPayment = monthlyPaymentRaw({
    principal,
    monthlyRate,
    termMonths,
    balloon,
  });

  const totalRepayment = monthlyPayment * termMonths + balloon;

  return {
    principal: roundCurrency(principal),
    monthlyRate,
    termMonths,
    balloon: roundCurrency(balloon),
    monthlyPayment: roundCurrency(monthlyPayment),
    totalRepayment: roundCurrency(totalRepayment),
    totalInterest: roundCurrency(totalRepayment - principal),
  };
}

export function calculateRemainingBalance(
  input: LoanTerms,
  paymentsMade: number,
): number {
  const loan = calculateLoan(input);
  const made = Math.min(
    loan.termMonths,
    Math.max(0, Math.round(finite(paymentsMade))),
  );

  if (loan.principal === 0) return 0;
  if (made === 0) return loan.principal;
  if (made >= loan.termMonths) return loan.balloon;

  const payment = monthlyPaymentRaw({
    principal: loan.principal,
    monthlyRate: loan.monthlyRate,
    termMonths: loan.termMonths,
    balloon: loan.balloon,
  });
  const rate = loan.monthlyRate;
  const balance =
    rate === 0
      ? loan.principal - payment * made
      : loan.principal * Math.pow(1 + rate, made) -
        payment * ((Math.pow(1 + rate, made) - 1) / rate);

  return roundCurrency(Math.max(loan.balloon, balance));
}

export function calculateServicePlan(
  input: ServicePlanInput,
): ServicePlanSummary {
  const interval = Math.max(1, nonNegative(input.serviceIntervalHours));
  const annualHours = nonNegative(input.expectedAnnualHours);
  const planYears = nonNegative(input.planYears);
  const servicesPerYear = annualHours / interval;
  const serviceCount = Math.ceil(servicesPerYear * planYears);
  const calculatedAmount = serviceCount * nonNegative(input.costPerService);
  const negotiated = finite(input.negotiatedAmount ?? Number.NaN, Number.NaN);
  const packageAmount =
    Number.isFinite(negotiated) && negotiated >= 0
      ? negotiated
      : calculatedAmount;

  return {
    servicesPerYear: Math.round(servicesPerYear * 100) / 100,
    serviceCount,
    calculatedAmount: roundCurrency(calculatedAmount),
    packageAmount: roundCurrency(packageAmount),
  };
}

export function calculateUptimeReserve(
  input: UptimeReserveInput,
): UptimeReserveSummary {
  const eventCount = Math.ceil(
    nonNegative(input.eventsPerYear) * nonNegative(input.postWarrantyYears),
  );
  const calculatedAmount = eventCount * nonNegative(input.costPerEvent);
  const fixedAmount = nonNegative(input.fixedAmount ?? calculatedAmount);

  return {
    eventCount,
    calculatedAmount: roundCurrency(calculatedAmount),
    packageAmount: roundCurrency(
      input.mode === "fixed" ? fixedAmount : calculatedAmount,
    ),
  };
}

export function calculateInflatedEventSpend(input: {
  costPerEvent: number;
  eventsPerYear: number;
  years: number;
  annualInflationPct: number;
  startAfterYears?: number;
}): { total: number; byYear: number[] } {
  const eventsPerYear = nonNegative(input.eventsPerYear);
  const years = Math.max(0, Math.round(nonNegative(input.years)));
  const eventCount = Math.ceil(eventsPerYear * years);
  const byYear = Array.from({ length: years }, () => 0);

  if (eventsPerYear === 0 || eventCount === 0) {
    return { total: 0, byYear };
  }

  const startAfterYears = nonNegative(input.startAfterYears ?? 0);
  const rate = nonNegative(input.annualInflationPct) / 100;

  for (let index = 1; index <= eventCount; index += 1) {
    const relativeYear = index / eventsPerYear;
    const eventTimeYears = startAfterYears + relativeYear;
    const eventCost =
      nonNegative(input.costPerEvent) * Math.pow(1 + rate, eventTimeYears);
    const yearIndex = Math.min(years - 1, Math.max(0, Math.ceil(relativeYear) - 1));
    byYear[yearIndex] += eventCost;
  }

  return {
    total: roundCurrency(byYear.reduce((sum, value) => sum + value, 0)),
    byYear: byYear.map(roundCurrency),
  };
}

export function calculateFutureAssetValue(
  input: FutureValueInput,
): FutureValueSummary {
  const yearsForward = Math.max(
    0,
    Math.round(finite(input.targetYear) - finite(input.purchaseYear)),
  );
  const newPrice = nonNegative(input.newPrice);
  const expectedHours = Math.round(
    nonNegative(input.startingHours) +
      nonNegative(input.expectedAnnualHours) * yearsForward,
  );
  const configuredLifetimeHours = Math.round(
    nonNegative(input.lifetimeHours ?? 0),
  );
  const lifetimeHours =
    configuredLifetimeHours > 0
      ? configuredLifetimeHours
      : tractorLifetimeHours(
          input.tractorType ?? "field",
          nonNegative(input.powerKw ?? 90),
        );
  const projectedReplacementPrice =
    newPrice *
    Math.pow(1 + nonNegative(input.inflationRatePct) / 100, yearsForward);

  if (yearsForward === 0) {
    return {
      yearsForward,
      expectedHours,
      lifetimeHours,
      projectedReplacementPrice: roundCurrency(newPrice),
      ageDepreciationPct: 0,
      usageDepreciationPct: 0,
      averageDepreciationPct: 0,
      conditionFactor: 1,
      valueBeforeCondition: roundCurrency(newPrice),
      conditionAdjustedValue: roundCurrency(newPrice),
      estimatedRetailValue: roundCurrency(newPrice),
    };
  }

  const valuation = calculateEngineHoursValue({
    replacementPriceExVat: projectedReplacementPrice,
    yearModel: Math.round(input.purchaseYear),
    hours: expectedHours,
    condition: input.condition,
    maxLifetimeHours: lifetimeHours,
    baseYear: Math.round(input.targetYear),
  });

  return {
    yearsForward,
    expectedHours,
    lifetimeHours,
    projectedReplacementPrice: roundCurrency(projectedReplacementPrice),
    ageDepreciationPct: valuation.ageDepPct,
    usageDepreciationPct: valuation.usageDepPct,
    averageDepreciationPct: valuation.averageDepPct,
    conditionFactor: CONDITION_FACTORS[input.condition],
    valueBeforeCondition: valuation.depreciatedValueExVat,
    conditionAdjustedValue: valuation.conditionAdjustedValueExVat,
    estimatedRetailValue: valuation.finalValueExVat,
  };
}

// Backwards-compatible export for existing tractor-specific callers.
export const calculateFutureTractorValue = calculateFutureAssetValue;

export function calculateTradeValue(input: TradeValueInput): TradeValueSummary {
  const retail = nonNegative(input.projectedRetailValue);
  let tradeValue = nonNegative(input.manualValue);

  if (input.mode === "haircut") {
    tradeValue = retail * (1 - Math.min(100, nonNegative(input.haircutPct)) / 100);
  } else if (input.mode === "dealer") {
    tradeValue = nonNegative(input.dealerOffer);
  }

  const haircutAmount = Math.max(0, retail - tradeValue);
  const haircutPct = retail > 0 ? (haircutAmount / retail) * 100 : 0;

  return {
    tradeValue: roundCurrency(tradeValue),
    haircutAmount: roundCurrency(haircutAmount),
    haircutPct: Math.round(haircutPct * 10) / 10,
  };
}

export function calculateEquity(
  tradeValue: number,
  settlementBalance: number,
): number {
  return roundCurrency(nonNegative(tradeValue) - nonNegative(settlementBalance));
}

export function calculateNextCycle(input: {
  equity: number;
  nextServicePlan: number;
  nextUptimeReserve: number;
  currentNewPrice: number;
  inflationRatePct: number;
  years: number;
}): {
  nextTractorPrice: number;
  serviceAllocation: number;
  reserveAllocation: number;
  remainingDeposit: number;
  allocationShortfall: number;
  nextFinancedAmount: number;
} {
  const equity = Math.max(0, finite(input.equity));
  const serviceAllocation = nonNegative(input.nextServicePlan);
  const reserveAllocation = nonNegative(input.nextUptimeReserve);
  const allocationTotal = serviceAllocation + reserveAllocation;
  const remainingDeposit = Math.max(0, equity - allocationTotal);
  const nextTractorPrice =
    nonNegative(input.currentNewPrice) *
    Math.pow(
      1 + nonNegative(input.inflationRatePct) / 100,
      nonNegative(input.years),
    );

  return {
    nextTractorPrice: roundCurrency(nextTractorPrice),
    serviceAllocation: roundCurrency(serviceAllocation),
    reserveAllocation: roundCurrency(reserveAllocation),
    remainingDeposit: roundCurrency(remainingDeposit),
    allocationShortfall: roundCurrency(Math.max(0, allocationTotal - equity)),
    nextFinancedAmount: roundCurrency(
      Math.max(0, nextTractorPrice - remainingDeposit),
    ),
  };
}

export function calculateRefinanceScenario(
  input: RefinanceInput,
): RefinanceSummary {
  const original = calculateLoan(input.originalLoan);
  const refinanceMonth = Math.min(
    original.termMonths,
    Math.max(0, Math.round(nonNegative(input.refinanceMonth))),
  );
  const settlementAmount = calculateRemainingBalance(
    input.originalLoan,
    refinanceMonth,
  );
  const replacement = calculateLoan({
    principal: settlementAmount,
    annualRatePct: input.newAnnualRatePct,
    termMonths: input.newTermMonths,
    balloon: input.newBalloon ?? 0,
  });
  const paymentsAlreadyMade = original.monthlyPayment * refinanceMonth;
  const restructuredTotalRepayment =
    paymentsAlreadyMade + replacement.totalRepayment;
  const newTotalFinanceCost =
    restructuredTotalRepayment - original.principal;

  return {
    settlementAmount: roundCurrency(settlementAmount),
    currentMonthlyPayment: original.monthlyPayment,
    newMonthlyPayment: replacement.monthlyPayment,
    monthlyRelief: roundCurrency(
      original.monthlyPayment - replacement.monthlyPayment,
    ),
    originalTotalRepayment: original.totalRepayment,
    restructuredTotalRepayment: roundCurrency(restructuredTotalRepayment),
    newTotalFinanceCost: roundCurrency(newTotalFinanceCost),
    additionalCost: roundCurrency(
      restructuredTotalRepayment - original.totalRepayment,
    ),
  };
}

function loanCashForYear(loan: LoanSummary, year: number): number {
  const startMonth = year * 12;
  const remainingMonths = Math.max(0, loan.termMonths - startMonth);
  const paidMonths = Math.min(12, remainingMonths);
  const balloonDue =
    loan.balloon > 0 &&
    loan.termMonths > startMonth &&
    loan.termMonths <= startMonth + 12
      ? loan.balloon
      : 0;
  return roundCurrency(loan.monthlyPayment * paidMonths + balloonDue);
}

export function buildCashFlowScenarios(input: {
  tractorPrice: number;
  deposit: number;
  fees: number;
  annualRatePct: number;
  termMonths: number;
  balloon: number;
  horizonYears: number;
  servicePlan: ServicePlanSummary;
  servicePlanYears: number;
  serviceCostPerEvent: number;
  reserve: UptimeReserveSummary;
  reserveCostPerEvent: number;
  reserveEventsPerYear: number;
  postWarrantyYears: number;
  partsInflationPct: number;
}): CashFlowScenario[] {
  const horizonYears = Math.max(1, Math.round(nonNegative(input.horizonYears)));
  const serviceEventsPerYear =
    input.servicePlanYears > 0
      ? input.servicePlan.serviceCount / input.servicePlanYears
      : 0;
  const serviceSpend = calculateInflatedEventSpend({
    costPerEvent: input.serviceCostPerEvent,
    eventsPerYear: serviceEventsPerYear,
    years: Math.min(horizonYears, Math.round(input.servicePlanYears)),
    annualInflationPct: input.partsInflationPct,
  });
  const reserveSpend = calculateInflatedEventSpend({
    costPerEvent: input.reserveCostPerEvent,
    eventsPerYear: input.reserveEventsPerYear,
    years: Math.min(horizonYears, Math.round(input.postWarrantyYears)),
    annualInflationPct: input.partsInflationPct,
    startAfterYears: input.servicePlanYears,
  });

  const scenarioInputs = [
    {
      id: "tractor" as const,
      label: "Option A — Asset only",
      description: "Lowest finance cost; servicing and maintenance are paid when incurred.",
      addOns: 0,
      serviceCash: true,
      reserveCash: true,
    },
    {
      id: "service" as const,
      label: "Option B — Asset + warranty service plan",
      description: "Scheduled dealer servicing is smoothed; later maintenance remains pay-as-you-go.",
      addOns: input.servicePlan.packageAmount,
      serviceCash: false,
      reserveCash: true,
    },
    {
      id: "full" as const,
      label: "Option C — Full lifecycle package",
      description: "Most predictable cash flow; both maintenance packages attract finance cost.",
      addOns: input.servicePlan.packageAmount + input.reserve.packageAmount,
      serviceCash: false,
      reserveCash: false,
    },
  ];

  return scenarioInputs.map((scenario) => {
    const loan = calculateLoan({
      principal: Math.max(
        0,
        nonNegative(input.tractorPrice) +
          nonNegative(input.fees) +
          scenario.addOns -
          nonNegative(input.deposit),
      ),
      annualRatePct: input.annualRatePct,
      termMonths: input.termMonths,
      balloon: input.balloon,
    });
    let cumulativeCash = 0;
    const years: CashFlowYear[] = [];

    for (let index = 0; index < horizonYears; index += 1) {
      const loanPayments = loanCashForYear(loan, index);
      const serviceCashPayments = scenario.serviceCash
        ? serviceSpend.byYear[index] ?? 0
        : 0;
      const reserveIndex = index - Math.round(input.servicePlanYears);
      const maintenanceCashPayments = scenario.reserveCash
        ? reserveSpend.byYear[reserveIndex] ?? 0
        : 0;
      const totalAnnualCash = roundCurrency(
        loanPayments + serviceCashPayments + maintenanceCashPayments,
      );
      cumulativeCash += totalAnnualCash;
      years.push({
        year: index + 1,
        loanPayments,
        serviceCashPayments,
        maintenanceCashPayments,
        totalAnnualCash,
        cumulativeCash: roundCurrency(cumulativeCash),
      });
    }

    return {
      id: scenario.id,
      label: scenario.label,
      description: scenario.description,
      loan,
      years,
      totalCashRequirement: roundCurrency(cumulativeCash),
    };
  });
}

export function buildLifecycleTimeline(input: {
  futureValue: Omit<FutureValueInput, "targetYear">;
  horizonYears: number;
  loan: LoanTerms;
  trade: Omit<TradeValueInput, "projectedRetailValue">;
  finalTradeValue: number;
  finalRetailValue: number;
  plannedMaintenanceByYear: number[];
}): TimelineRow[] {
  const horizonYears = Math.max(1, Math.round(nonNegative(input.horizonYears)));
  const finalTradeRatio =
    input.finalRetailValue > 0
      ? Math.max(0, input.finalTradeValue / input.finalRetailValue)
      : 0;

  return Array.from({ length: horizonYears + 1 }, (_, year) => {
    const future = calculateFutureAssetValue({
      ...input.futureValue,
      targetYear: input.futureValue.purchaseYear + year,
    });
    const directTrade = calculateTradeValue({
      ...input.trade,
      projectedRetailValue: future.estimatedRetailValue,
    }).tradeValue;
    const tradeValue =
      input.trade.mode === "haircut"
        ? directTrade
        : roundCurrency(future.estimatedRetailValue * finalTradeRatio);
    const paymentsMade = Math.min(input.loan.termMonths, year * 12);
    const loanBalance = calculateRemainingBalance(input.loan, paymentsMade);

    return {
      year,
      hours: future.expectedHours,
      replacementPrice: future.projectedReplacementPrice,
      estimatedRetailValue: future.estimatedRetailValue,
      tradeValue,
      loanBalance,
      equity: calculateEquity(tradeValue, loanBalance),
      plannedMaintenance:
        year === 0 ? 0 : input.plannedMaintenanceByYear[year - 1] ?? 0,
    };
  });
}

export function calculateDealerEconomics(
  input: DealerEconomicsInput,
): DealerEconomicsSummary {
  const tradeContribution =
    finite(input.expectedResalePrice) -
    finite(input.tradeAllowance) -
    nonNegative(input.reconCost) -
    nonNegative(input.holdingCost);
  const grossMargin = Math.min(100, nonNegative(input.grossMarginPct)) / 100;
  const servicePartsContribution =
    (nonNegative(input.servicePlanRevenue) +
      nonNegative(input.uptimeReserveRevenue)) *
    grossMargin;
  const newTractorContribution = finite(input.newTractorGrossProfit);
  const totalGrossContribution =
    tradeContribution + servicePartsContribution + newTractorContribution;
  const riskReserve = nonNegative(input.riskReserve);

  return {
    tradeContribution: roundCurrency(tradeContribution),
    servicePartsContribution: roundCurrency(servicePartsContribution),
    newTractorContribution: roundCurrency(newTractorContribution),
    totalGrossContribution: roundCurrency(totalGrossContribution),
    riskReserve: roundCurrency(riskReserve),
    commercialBuffer: roundCurrency(totalGrossContribution - riskReserve),
  };
}
