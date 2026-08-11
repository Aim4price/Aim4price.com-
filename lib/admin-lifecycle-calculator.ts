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

function calculateSettlementAtHorizon(
  input: LoanTerms,
  paymentsMade: number,
  balloonPaidAsScheduled = false,
): number {
  const loan = calculateLoan(input);
  const made = Math.max(0, Math.round(finite(paymentsMade)));

  // At an exact disposal/finance horizon the residual is settled from the
  // disposal proceeds. When ownership continues beyond the term, the balloon
  // is paid when due and must no longer reduce later timeline equity.
  if (
    made > loan.termMonths ||
    (balloonPaidAsScheduled && made >= loan.termMonths)
  ) {
    return 0;
  }
  return calculateRemainingBalance(input, made);
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
  nextAssetPrice: number;
  nextTractorPrice: number;
  serviceAllocation: number;
  reserveAllocation: number;
  remainingDeposit: number;
  negativeEquityShortfall: number;
  allocationShortfall: number;
  nextFinancedAmount: number;
} {
  const equity = finite(input.equity);
  const availableEquity = Math.max(0, equity);
  const negativeEquityShortfall = Math.max(0, -equity);
  const serviceAllocation = nonNegative(input.nextServicePlan);
  const reserveAllocation = nonNegative(input.nextUptimeReserve);
  const allocationTotal = serviceAllocation + reserveAllocation;
  const remainingDeposit = Math.max(0, availableEquity - allocationTotal);
  const allocationShortfall = Math.max(0, allocationTotal - availableEquity);
  const nextTractorPrice =
    nonNegative(input.currentNewPrice) *
    Math.pow(
      1 + nonNegative(input.inflationRatePct) / 100,
      nonNegative(input.years),
    );

  return {
    nextAssetPrice: roundCurrency(nextTractorPrice),
    nextTractorPrice: roundCurrency(nextTractorPrice),
    serviceAllocation: roundCurrency(serviceAllocation),
    reserveAllocation: roundCurrency(reserveAllocation),
    remainingDeposit: roundCurrency(remainingDeposit),
    negativeEquityShortfall: roundCurrency(negativeEquityShortfall),
    allocationShortfall: roundCurrency(allocationShortfall),
    nextFinancedAmount: roundCurrency(
      Math.max(
        0,
        nextTractorPrice +
          negativeEquityShortfall +
          allocationShortfall -
          remainingDeposit,
      ),
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

function loanCashForYear(
  loan: LoanSummary,
  year: number,
  includeBalloonDue = true,
): number {
  const startMonth = year * 12;
  const remainingMonths = Math.max(0, loan.termMonths - startMonth);
  const paidMonths = Math.min(12, remainingMonths);
  const balloonDue =
    includeBalloonDue &&
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

export type LifecycleUsageBasis = "hours" | "kilometres" | "percentage";
export type LifecycleServiceBasis = "usage" | "calendar" | "count" | "manual";
export type LifecycleScenarioId = "standard" | "service" | "full";

export type LifecycleModelInput = {
  assetPrice: number;
  vatTreatment: VatTreatment;
  vatRatePct: number;
  purchaseYear: number;
  ownershipYears: number;
  usageBasis: LifecycleUsageBasis;
  startingUsage: number;
  annualUsage: number;
  lifetimeUsage: number;
  disposalLifeWorkedPct: number;
  condition: ConditionKey;
  assetInflationPct: number;
  deposit: number;
  annualRatePct: number;
  financeTermMonths: number;
  balloon: number;
  financeFees: number;
  serviceBasis: LifecycleServiceBasis;
  serviceInterval: number;
  serviceCalendarIntervalMonths: number;
  fixedServiceCount: number;
  serviceCost: number;
  serviceCoverageYears: number;
  useNegotiatedServiceAmount: boolean;
  negotiatedServiceAmount: number;
  maintenanceStartAfterYears: number;
  maintenanceYears: number;
  maintenanceEventsPerYear: number;
  maintenanceCostPerEvent: number;
  negotiatedMaintenanceReserve: number;
  maintenanceInflationPct: number;
  tradeMode: TradeMode;
  tradeHaircutPct: number;
  manualTradeValue: number;
  dealerOffer: number;
};

export type LifecycleVatAmount = VatSummary & {
  enteredAmount: number;
};

export type LifecycleServiceProvision = {
  basis: LifecycleServiceBasis;
  serviceCount: number;
  servicesPerYear: number;
  coverageYears: number;
  calculated: LifecycleVatAmount;
  selected: LifecycleVatAmount;
  nominalPayAsYouGo: number;
  payAsYouGoByYear: number[];
};

export type LifecycleMaintenanceProvision = {
  startAfterYears: number;
  years: number;
  eventCount: number;
  currentMoneyRequirement: LifecycleVatAmount;
  selectedReserve: LifecycleVatAmount;
  nominalPayAsYouGo: number;
  payAsYouGoByYear: number[];
  inflationAvoided: number;
};

export type LifecycleCashFlowYear = {
  year: number;
  depositPayment: number;
  loanPayments: number;
  serviceCashPayments: number;
  maintenanceCashPayments: number;
  totalAnnualCash: number;
  cumulativeCash: number;
};

export type LifecycleScenarioSummary = {
  id: LifecycleScenarioId;
  label: string;
  shortLabel: string;
  description: string;
  assetAmount: number;
  serviceFinanced: number;
  maintenanceFinanced: number;
  financeFees: number;
  deposit: number;
  loanTerms: LoanTerms;
  loan: LoanSummary;
  settlementAtDisposal: number;
  equityAtDisposal: number;
  cashFlow: LifecycleCashFlowYear[];
  totalLifecycleCashRequirement: number;
  netOwnershipCostAfterTrade: number;
  costPerUsageUnit: number;
  financePremiumForLiquidity: number;
  additionalMonthlyPayment: number;
  workingCapitalProtected: number;
  serviceCashRequiredLater: boolean;
  maintenanceCashRequiredLater: boolean;
  predictability: "Lowest" | "Medium" | "Highest";
};

export type LifecycleFuturePosition = {
  startingPrice: LifecycleVatAmount;
  projectedReplacementPrice: LifecycleVatAmount;
  projectedRetail: LifecycleVatAmount;
  tradeValue: LifecycleVatAmount;
  yearsForward: number;
  projectedUsage: number;
  lifetimeUsage: number;
  ageDepreciationPct: number;
  usageDepreciationPct: number;
  averageDepreciationPct: number;
  conditionFactor: number;
  condition: ConditionKey;
  tradeHaircutAmount: number;
  tradeHaircutPct: number;
};

export type LifecycleTimelineRow = {
  year: number;
  projectedUsage: number;
  replacementPriceExVat: number;
  replacementPriceInclVat: number;
  ageDepreciationPct: number;
  usageDepreciationPct: number;
  projectedRetailExVat: number;
  projectedRetailInclVat: number;
  projectedTradeInclVat: number;
  settlementStandard: number;
  settlementService: number;
  settlementFull: number;
  equityStandard: number;
  equityService: number;
  equityFull: number;
};

export type LifecycleWorkspaceModel = {
  input: LifecycleModelInput;
  usageUnit: "h" | "km" | "%";
  usageUnitLong: "hour" | "km" | "percentage point";
  usageConsumed: number;
  future: LifecycleFuturePosition;
  service: LifecycleServiceProvision;
  maintenance: LifecycleMaintenanceProvision;
  packageVat: Record<LifecycleScenarioId, LifecycleVatAmount>;
  scenarios: LifecycleScenarioSummary[];
  timeline: LifecycleTimelineRow[];
};

export const DEFAULT_LIFECYCLE_MODEL_INPUT: LifecycleModelInput = {
  assetPrice: 500_000,
  vatTreatment: "included",
  vatRatePct: 15,
  purchaseYear: new Date().getFullYear(),
  ownershipYears: 5,
  usageBasis: "hours",
  startingUsage: 0,
  annualUsage: 1_000,
  lifetimeUsage: 14_000,
  disposalLifeWorkedPct: 35,
  condition: "good",
  assetInflationPct: 3,
  deposit: 0,
  annualRatePct: 10.5,
  financeTermMonths: 60,
  balloon: 0,
  financeFees: 0,
  serviceBasis: "usage",
  serviceInterval: 250,
  serviceCalendarIntervalMonths: 6,
  fixedServiceCount: 8,
  serviceCost: 8_000,
  serviceCoverageYears: 2,
  useNegotiatedServiceAmount: true,
  negotiatedServiceAmount: 64_000,
  maintenanceStartAfterYears: 2,
  maintenanceYears: 3,
  maintenanceEventsPerYear: 4,
  maintenanceCostPerEvent: 4_000,
  negotiatedMaintenanceReserve: 50_000,
  maintenanceInflationPct: 3,
  tradeMode: "haircut",
  tradeHaircutPct: 12,
  manualTradeValue: 260_000,
  dealerOffer: 260_000,
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function normalizedNumber(
  value: unknown,
  fallback: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizedEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function normalizeLifecycleModelInput(
  value: unknown,
): LifecycleModelInput {
  const source = asRecord(value);
  const fallback = DEFAULT_LIFECYCLE_MODEL_INPUT;

  return {
    assetPrice: normalizedNumber(source.assetPrice, fallback.assetPrice, 0, 1_000_000_000),
    vatTreatment: normalizedEnum(source.vatTreatment, ["included", "excluded"] as const, fallback.vatTreatment),
    vatRatePct: normalizedNumber(source.vatRatePct, fallback.vatRatePct, 0, 30),
    purchaseYear: Math.round(normalizedNumber(source.purchaseYear, fallback.purchaseYear, 1900, 2200)),
    ownershipYears: Math.round(normalizedNumber(source.ownershipYears, fallback.ownershipYears, 1, 50)),
    usageBasis: normalizedEnum(source.usageBasis, ["hours", "kilometres", "percentage"] as const, fallback.usageBasis),
    startingUsage: normalizedNumber(source.startingUsage, fallback.startingUsage, 0, 100_000_000),
    annualUsage: normalizedNumber(source.annualUsage, fallback.annualUsage, 0, 100_000_000),
    lifetimeUsage: normalizedNumber(source.lifetimeUsage, fallback.lifetimeUsage, 1, 100_000_000),
    disposalLifeWorkedPct: normalizedNumber(source.disposalLifeWorkedPct, fallback.disposalLifeWorkedPct, 0, 100),
    condition: normalizedEnum(source.condition, ["excellent", "good", "fair", "used", "serious"] as const, fallback.condition),
    assetInflationPct: normalizedNumber(source.assetInflationPct, fallback.assetInflationPct, 0, 50),
    deposit: normalizedNumber(source.deposit, fallback.deposit, 0, 1_000_000_000),
    annualRatePct: normalizedNumber(source.annualRatePct, fallback.annualRatePct, 0, 100),
    financeTermMonths: Math.round(normalizedNumber(source.financeTermMonths, fallback.financeTermMonths, 1, 600)),
    balloon: normalizedNumber(source.balloon, fallback.balloon, 0, 1_000_000_000),
    financeFees: normalizedNumber(source.financeFees, fallback.financeFees, 0, 100_000_000),
    serviceBasis: normalizedEnum(source.serviceBasis, ["usage", "calendar", "count", "manual"] as const, fallback.serviceBasis),
    serviceInterval: normalizedNumber(source.serviceInterval, fallback.serviceInterval, 1, 100_000_000),
    serviceCalendarIntervalMonths: normalizedNumber(source.serviceCalendarIntervalMonths, fallback.serviceCalendarIntervalMonths, 1, 600),
    fixedServiceCount: Math.round(normalizedNumber(source.fixedServiceCount, fallback.fixedServiceCount, 0, 10_000)),
    serviceCost: normalizedNumber(source.serviceCost, fallback.serviceCost, 0, 100_000_000),
    serviceCoverageYears: normalizedNumber(source.serviceCoverageYears, fallback.serviceCoverageYears, 0, 50),
    useNegotiatedServiceAmount: source.useNegotiatedServiceAmount !== false,
    negotiatedServiceAmount: normalizedNumber(source.negotiatedServiceAmount, fallback.negotiatedServiceAmount, 0, 1_000_000_000),
    maintenanceStartAfterYears: normalizedNumber(source.maintenanceStartAfterYears, fallback.maintenanceStartAfterYears, 0, 50),
    maintenanceYears: normalizedNumber(source.maintenanceYears, fallback.maintenanceYears, 0, 50),
    maintenanceEventsPerYear: normalizedNumber(source.maintenanceEventsPerYear, fallback.maintenanceEventsPerYear, 0, 10_000),
    maintenanceCostPerEvent: normalizedNumber(source.maintenanceCostPerEvent, fallback.maintenanceCostPerEvent, 0, 100_000_000),
    negotiatedMaintenanceReserve: normalizedNumber(source.negotiatedMaintenanceReserve, fallback.negotiatedMaintenanceReserve, 0, 1_000_000_000),
    maintenanceInflationPct: normalizedNumber(source.maintenanceInflationPct, fallback.maintenanceInflationPct, 0, 50),
    tradeMode: normalizedEnum(source.tradeMode, ["manual", "haircut", "dealer"] as const, fallback.tradeMode),
    tradeHaircutPct: normalizedNumber(source.tradeHaircutPct, fallback.tradeHaircutPct, 0, 100),
    manualTradeValue: normalizedNumber(source.manualTradeValue, fallback.manualTradeValue, 0, 1_000_000_000),
    dealerOffer: normalizedNumber(source.dealerOffer, fallback.dealerOffer, 0, 1_000_000_000),
  };
}

function vatAmount(
  enteredAmount: number,
  treatment: VatTreatment,
  vatRatePct: number,
): LifecycleVatAmount {
  return {
    enteredAmount: roundCurrency(nonNegative(enteredAmount)),
    ...calculateVatSummary(enteredAmount, treatment, vatRatePct),
  };
}

function vatFromExVat(exVatAmount: number, vatRatePct: number): LifecycleVatAmount {
  return vatAmount(exVatAmount, "excluded", vatRatePct);
}

function combinedVatAmount(
  amounts: LifecycleVatAmount[],
): LifecycleVatAmount {
  const netAmount = roundCurrency(amounts.reduce((sum, amount) => sum + amount.netAmount, 0));
  const vatAmountValue = roundCurrency(amounts.reduce((sum, amount) => sum + amount.vatAmount, 0));
  const grossAmount = roundCurrency(amounts.reduce((sum, amount) => sum + amount.grossAmount, 0));
  return {
    enteredAmount: roundCurrency(amounts.reduce((sum, amount) => sum + amount.enteredAmount, 0)),
    netAmount,
    vatAmount: vatAmountValue,
    grossAmount,
  };
}

function distributedInflatedSpend(input: {
  currentTotal: number;
  years: number;
  annualInflationPct: number;
  startAfterYears?: number;
}): { total: number; byYear: number[] } {
  const years = Math.max(0, Math.round(nonNegative(input.years)));
  if (years === 0 || input.currentTotal <= 0) return { total: 0, byYear: [] };
  const annualBase = nonNegative(input.currentTotal) / years;
  const rate = nonNegative(input.annualInflationPct) / 100;
  const start = nonNegative(input.startAfterYears ?? 0);
  const byYear = Array.from({ length: years }, (_, index) =>
    roundCurrency(annualBase * Math.pow(1 + rate, start + index + 0.5)),
  );
  return {
    total: roundCurrency(byYear.reduce((sum, amount) => sum + amount, 0)),
    byYear,
  };
}

function calculateLifecycleService(
  input: LifecycleModelInput,
): LifecycleServiceProvision {
  const coverageYears = Math.min(input.ownershipYears, nonNegative(input.serviceCoverageYears));
  let serviceCount = 0;
  let servicesPerYear = 0;

  if (input.serviceBasis === "usage") {
    const annualServiceUsage = input.usageBasis === "percentage"
      ? Math.max(0, input.disposalLifeWorkedPct - input.startingUsage) /
        Math.max(1, input.ownershipYears)
      : nonNegative(input.annualUsage);
    servicesPerYear = annualServiceUsage / Math.max(1, nonNegative(input.serviceInterval));
    serviceCount = Math.ceil(servicesPerYear * coverageYears);
  } else if (input.serviceBasis === "calendar") {
    servicesPerYear = 12 / Math.max(1, nonNegative(input.serviceCalendarIntervalMonths));
    serviceCount = Math.ceil(servicesPerYear * coverageYears);
  } else if (input.serviceBasis === "count") {
    serviceCount = Math.round(nonNegative(input.fixedServiceCount));
    servicesPerYear = coverageYears > 0 ? serviceCount / coverageYears : 0;
  }

  const calculatedEnteredAmount = serviceCount * nonNegative(input.serviceCost);
  const selectedEnteredAmount =
    input.serviceBasis === "manual" || input.useNegotiatedServiceAmount
      ? nonNegative(input.negotiatedServiceAmount)
      : calculatedEnteredAmount;
  const calculated = vatAmount(calculatedEnteredAmount, input.vatTreatment, input.vatRatePct);
  const selected = vatAmount(selectedEnteredAmount, input.vatTreatment, input.vatRatePct);
  const payAsYouGo = serviceCount > 0 && servicesPerYear > 0
    ? calculateInflatedEventSpend({
        costPerEvent: vatAmount(input.serviceCost, input.vatTreatment, input.vatRatePct).grossAmount,
        eventsPerYear: servicesPerYear,
        years: coverageYears,
        annualInflationPct: input.maintenanceInflationPct,
      })
    : distributedInflatedSpend({
        currentTotal: selected.grossAmount,
        years: coverageYears,
        annualInflationPct: input.maintenanceInflationPct,
      });

  return {
    basis: input.serviceBasis,
    serviceCount,
    servicesPerYear: Math.round(servicesPerYear * 100) / 100,
    coverageYears,
    calculated,
    selected,
    nominalPayAsYouGo: payAsYouGo.total,
    payAsYouGoByYear: payAsYouGo.byYear,
  };
}

function calculateLifecycleMaintenance(
  input: LifecycleModelInput,
): LifecycleMaintenanceProvision {
  const startAfterYears = Math.min(input.ownershipYears, nonNegative(input.maintenanceStartAfterYears));
  const availableYears = Math.max(0, input.ownershipYears - startAfterYears);
  const years = Math.min(availableYears, nonNegative(input.maintenanceYears));
  const eventCount = Math.ceil(nonNegative(input.maintenanceEventsPerYear) * years);
  const currentMoneyEntered = eventCount * nonNegative(input.maintenanceCostPerEvent);
  const currentMoneyRequirement = vatAmount(currentMoneyEntered, input.vatTreatment, input.vatRatePct);
  const selectedReserve = vatAmount(input.negotiatedMaintenanceReserve, input.vatTreatment, input.vatRatePct);
  const payAsYouGo = calculateInflatedEventSpend({
    costPerEvent: vatAmount(input.maintenanceCostPerEvent, input.vatTreatment, input.vatRatePct).grossAmount,
    eventsPerYear: input.maintenanceEventsPerYear,
    years,
    annualInflationPct: input.maintenanceInflationPct,
    startAfterYears,
  });

  return {
    startAfterYears,
    years,
    eventCount,
    currentMoneyRequirement,
    selectedReserve,
    nominalPayAsYouGo: payAsYouGo.total,
    payAsYouGoByYear: payAsYouGo.byYear,
    inflationAvoided: roundCurrency(payAsYouGo.total - selectedReserve.grossAmount),
  };
}

function calculateFuturePositionAtYear(
  input: LifecycleModelInput,
  year: number,
): LifecycleFuturePosition {
  const yearsForward = Math.max(0, Math.min(input.ownershipYears, Math.round(year)));
  const startingPrice = vatAmount(input.assetPrice, input.vatTreatment, input.vatRatePct);
  const projectedUsage = input.usageBasis === "percentage"
    ? nonNegative(input.startingUsage) +
      (Math.max(nonNegative(input.startingUsage), input.disposalLifeWorkedPct) - nonNegative(input.startingUsage)) *
        (input.ownershipYears > 0 ? yearsForward / input.ownershipYears : 0)
    : nonNegative(input.startingUsage) + nonNegative(input.annualUsage) * yearsForward;
  const lifetimeUsage = input.usageBasis === "percentage" ? 100 : Math.max(1, input.lifetimeUsage);
  const annualizedUsage = yearsForward > 0
    ? (projectedUsage - nonNegative(input.startingUsage)) / yearsForward
    : 0;
  const futureExVat = calculateFutureAssetValue({
    newPrice: startingPrice.netAmount,
    purchaseYear: input.purchaseYear,
    targetYear: input.purchaseYear + yearsForward,
    startingHours: input.startingUsage,
    expectedAnnualHours: annualizedUsage,
    lifetimeHours: lifetimeUsage,
    condition: input.condition,
    inflationRatePct: input.assetInflationPct,
  });
  const projectedReplacementPrice = vatFromExVat(futureExVat.projectedReplacementPrice, input.vatRatePct);
  const projectedRetail = vatFromExVat(futureExVat.estimatedRetailValue, input.vatRatePct);
  const tradeGross = calculateTradeValue({
    mode: input.tradeMode,
    projectedRetailValue: projectedRetail.grossAmount,
    manualValue: input.manualTradeValue,
    haircutPct: input.tradeHaircutPct,
    dealerOffer: input.dealerOffer,
  });
  const tradeValue = vatAmount(tradeGross.tradeValue, "included", input.vatRatePct);

  return {
    startingPrice,
    projectedReplacementPrice,
    projectedRetail,
    tradeValue,
    yearsForward,
    projectedUsage: Math.round(projectedUsage * 10) / 10,
    lifetimeUsage,
    ageDepreciationPct: futureExVat.ageDepreciationPct,
    usageDepreciationPct: futureExVat.usageDepreciationPct,
    averageDepreciationPct: futureExVat.averageDepreciationPct,
    conditionFactor: futureExVat.conditionFactor,
    condition: input.condition,
    tradeHaircutAmount: tradeGross.haircutAmount,
    tradeHaircutPct: tradeGross.haircutPct,
  };
}

export function buildLifecycleWorkspaceModel(
  rawInput: LifecycleModelInput | unknown,
): LifecycleWorkspaceModel {
  const input = normalizeLifecycleModelInput(rawInput);
  const service = calculateLifecycleService(input);
  const maintenance = calculateLifecycleMaintenance(input);
  const future = calculateFuturePositionAtYear(input, input.ownershipYears);
  const usageUnit = input.usageBasis === "hours" ? "h" : input.usageBasis === "kilometres" ? "km" : "%";
  const usageUnitLong = input.usageBasis === "hours" ? "hour" : input.usageBasis === "kilometres" ? "km" : "percentage point";
  const usageConsumed = Math.max(1, future.projectedUsage - input.startingUsage);
  const packageVat: Record<LifecycleScenarioId, LifecycleVatAmount> = {
    standard: future.startingPrice,
    service: combinedVatAmount([future.startingPrice, service.selected]),
    full: combinedVatAmount([future.startingPrice, service.selected, maintenance.selectedReserve]),
  };
  const definitions: Array<{
    id: LifecycleScenarioId;
    label: string;
    shortLabel: string;
    description: string;
    serviceFinanced: number;
    maintenanceFinanced: number;
    serviceCashRequiredLater: boolean;
    maintenanceCashRequiredLater: boolean;
    predictability: "Lowest" | "Medium" | "Highest";
  }> = [
    {
      id: "standard",
      label: "Standard",
      shortLabel: "Standard",
      description: "Lowest finance cost; service and maintenance remain operating-cash payments.",
      serviceFinanced: 0,
      maintenanceFinanced: 0,
      serviceCashRequiredLater: true,
      maintenanceCashRequiredLater: true,
      predictability: "Lowest",
    },
    {
      id: "service",
      label: "Service Plan",
      shortLabel: "Service",
      description: "Scheduled service is funded with the asset; maintenance remains pay-as-you-go.",
      serviceFinanced: service.selected.grossAmount,
      maintenanceFinanced: 0,
      serviceCashRequiredLater: false,
      maintenanceCashRequiredLater: true,
      predictability: "Medium",
    },
    {
      id: "full",
      label: "Service + Maintenance",
      shortLabel: "Full",
      description: "Both planned service and the maintenance reserve are converted into predictable funding.",
      serviceFinanced: service.selected.grossAmount,
      maintenanceFinanced: maintenance.selectedReserve.grossAmount,
      serviceCashRequiredLater: false,
      maintenanceCashRequiredLater: false,
      predictability: "Highest",
    },
  ];
  const ownershipMonths = input.ownershipYears * 12;
  const balloonPaidBeforeDisposal =
    input.financeTermMonths < ownershipMonths;
  const preliminary = definitions.map((definition) => {
    const principal = Math.max(
      0,
      future.startingPrice.grossAmount +
        definition.serviceFinanced +
        definition.maintenanceFinanced +
        input.financeFees -
        input.deposit,
    );
    const loanTerms: LoanTerms = {
      principal,
      annualRatePct: input.annualRatePct,
      termMonths: input.financeTermMonths,
      balloon: input.balloon,
    };
    const loan = calculateLoan(loanTerms);
    const settlementAtDisposal = calculateSettlementAtHorizon(
      loanTerms,
      ownershipMonths,
      balloonPaidBeforeDisposal,
    );
    const equityAtDisposal = calculateEquity(future.tradeValue.grossAmount, settlementAtDisposal);
    let cumulativeCash = 0;
    const cashFlow = Array.from({ length: input.ownershipYears }, (_, index): LifecycleCashFlowYear => {
      const depositPayment = index === 0 ? roundCurrency(input.deposit) : 0;
      const loanPayments = loanCashForYear(
        loan,
        index,
        balloonPaidBeforeDisposal,
      );
      const serviceCashPayments = definition.serviceCashRequiredLater
        ? service.payAsYouGoByYear[index] ?? 0
        : 0;
      const maintenanceIndex = index - Math.round(maintenance.startAfterYears);
      const maintenanceCashPayments = definition.maintenanceCashRequiredLater
        ? maintenance.payAsYouGoByYear[maintenanceIndex] ?? 0
        : 0;
      const totalAnnualCash = roundCurrency(
        depositPayment + loanPayments + serviceCashPayments + maintenanceCashPayments,
      );
      cumulativeCash += totalAnnualCash;
      return {
        year: index + 1,
        depositPayment,
        loanPayments,
        serviceCashPayments,
        maintenanceCashPayments,
        totalAnnualCash,
        cumulativeCash: roundCurrency(cumulativeCash),
      };
    });
    const workingCapitalProtected =
      (definition.serviceCashRequiredLater ? 0 : service.nominalPayAsYouGo) +
      (definition.maintenanceCashRequiredLater ? 0 : maintenance.nominalPayAsYouGo);
    const totalLifecycleCashRequirement = roundCurrency(cumulativeCash);
    const netOwnershipCostAfterTrade = roundCurrency(totalLifecycleCashRequirement - equityAtDisposal);

    return {
      ...definition,
      assetAmount: future.startingPrice.grossAmount,
      financeFees: roundCurrency(input.financeFees),
      deposit: roundCurrency(input.deposit),
      loanTerms,
      loan,
      settlementAtDisposal,
      equityAtDisposal,
      cashFlow,
      totalLifecycleCashRequirement,
      netOwnershipCostAfterTrade,
      costPerUsageUnit: roundCurrency(netOwnershipCostAfterTrade / usageConsumed),
      workingCapitalProtected: roundCurrency(workingCapitalProtected),
    };
  });
  const standard = preliminary[0];
  const scenarios: LifecycleScenarioSummary[] = preliminary.map((scenario) => ({
    ...scenario,
    financePremiumForLiquidity: roundCurrency(scenario.loan.totalInterest - standard.loan.totalInterest),
    additionalMonthlyPayment: roundCurrency(scenario.loan.monthlyPayment - standard.loan.monthlyPayment),
  }));
  const scenarioById = Object.fromEntries(
    scenarios.map((scenario) => [scenario.id, scenario]),
  ) as Record<LifecycleScenarioId, LifecycleScenarioSummary>;
  const timeline = Array.from({ length: input.ownershipYears + 1 }, (_, year): LifecycleTimelineRow => {
    const position = calculateFuturePositionAtYear(input, year);
    const paymentsMade = year * 12;
    const settlementStandard = calculateSettlementAtHorizon(
      scenarioById.standard.loanTerms,
      paymentsMade,
      balloonPaidBeforeDisposal,
    );
    const settlementService = calculateSettlementAtHorizon(
      scenarioById.service.loanTerms,
      paymentsMade,
      balloonPaidBeforeDisposal,
    );
    const settlementFull = calculateSettlementAtHorizon(
      scenarioById.full.loanTerms,
      paymentsMade,
      balloonPaidBeforeDisposal,
    );
    return {
      year,
      projectedUsage: position.projectedUsage,
      replacementPriceExVat: position.projectedReplacementPrice.netAmount,
      replacementPriceInclVat: position.projectedReplacementPrice.grossAmount,
      ageDepreciationPct: position.ageDepreciationPct,
      usageDepreciationPct: position.usageDepreciationPct,
      projectedRetailExVat: position.projectedRetail.netAmount,
      projectedRetailInclVat: position.projectedRetail.grossAmount,
      projectedTradeInclVat: position.tradeValue.grossAmount,
      settlementStandard,
      settlementService,
      settlementFull,
      equityStandard: calculateEquity(position.tradeValue.grossAmount, settlementStandard),
      equityService: calculateEquity(position.tradeValue.grossAmount, settlementService),
      equityFull: calculateEquity(position.tradeValue.grossAmount, settlementFull),
    };
  });

  return {
    input,
    usageUnit,
    usageUnitLong,
    usageConsumed,
    future,
    service,
    maintenance,
    packageVat,
    scenarios,
    timeline,
  };
}
