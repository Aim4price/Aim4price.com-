import {
  buildLifecycleWorkspaceModel,
  calculateDealerEconomics,
  calculateNextCycle,
  calculateRefinanceScenario,
  normalizeLifecycleModelInput,
  type DealerEconomicsSummary,
  type LifecycleModelInput,
  type LifecycleScenarioId,
  type LifecycleScenarioSummary,
  type LifecycleWorkspaceModel,
} from "./admin-lifecycle-calculator";
import type {
  XlsxCellStyle,
  XlsxCellValue,
  XlsxPrimitiveCellValue,
  XlsxSheet,
} from "./simple-xlsx";

export type LifecycleReportRequest = {
  modelInput: LifecycleModelInput;
  clientName?: string;
  assetDescription?: string;
  preferredScenario?: LifecycleScenarioId;
  nextServiceAllocation?: number;
  nextMaintenanceAllocation?: number;
  refinanceMonth?: number;
  refinanceRatePct?: number;
  refinanceTermMonths?: number;
  refinanceBalloon?: number;
  stressInterestRatePct?: number;
  stressAssetInflationPct?: number;
  stressMaintenanceInflationPct?: number;
  stressTradeHaircutPct?: number;
  stressOwnershipYears?: number;
  stressAnnualUsage?: number;
  stressCondition?: LifecycleModelInput["condition"];
  includeDealerEconomics?: boolean;
  dealerTradeAllowance?: number;
  dealerExpectedResale?: number;
  dealerReconCost?: number;
  dealerHoldingCost?: number;
  dealerGrossMarginPct?: number;
  dealerNewAssetProfit?: number;
  dealerRiskReserve?: number;
};

export type LifecycleReportContext = {
  request: Required<LifecycleReportRequest>;
  model: LifecycleWorkspaceModel;
  preferred: LifecycleScenarioSummary;
  nextCycle: ReturnType<typeof calculateNextCycle>;
  refinance: ReturnType<typeof calculateRefinanceScenario>;
  sensitivity: Array<{
    label: "Base" | "Conservative" | "Stress";
    model: LifecycleWorkspaceModel;
  }>;
  dealer: Array<{
    id: LifecycleScenarioId;
    label: string;
    result: DealerEconomicsSummary;
  }>;
};

function text(value: unknown, maxLength = 160): string {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function number(value: unknown, fallback: number, min = 0, max = 1_000_000_000): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function scenarioId(value: unknown): LifecycleScenarioId {
  return value === "service" || value === "full" ? value : "standard";
}

function normalizeRequest(value: LifecycleReportRequest | unknown): Required<LifecycleReportRequest> {
  const source = typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
  const modelInput = normalizeLifecycleModelInput(source.modelInput);

  return {
    modelInput,
    clientName: text(source.clientName),
    assetDescription: text(source.assetDescription),
    preferredScenario: scenarioId(source.preferredScenario),
    nextServiceAllocation: number(source.nextServiceAllocation, modelInput.negotiatedServiceAmount),
    nextMaintenanceAllocation: number(source.nextMaintenanceAllocation, modelInput.negotiatedMaintenanceReserve),
    refinanceMonth: Math.round(number(source.refinanceMonth, Math.min(36, modelInput.financeTermMonths), 1, modelInput.financeTermMonths)),
    refinanceRatePct: number(source.refinanceRatePct, modelInput.annualRatePct, 0, 100),
    refinanceTermMonths: Math.round(number(source.refinanceTermMonths, 48, 1, 600)),
    refinanceBalloon: number(source.refinanceBalloon, 0),
    stressInterestRatePct: number(source.stressInterestRatePct, modelInput.annualRatePct + 3, 0, 100),
    stressAssetInflationPct: number(source.stressAssetInflationPct, Math.max(0, modelInput.assetInflationPct - 2), 0, 50),
    stressMaintenanceInflationPct: number(source.stressMaintenanceInflationPct, modelInput.maintenanceInflationPct + 3, 0, 50),
    stressTradeHaircutPct: number(source.stressTradeHaircutPct, Math.min(100, modelInput.tradeHaircutPct + 10), 0, 100),
    stressOwnershipYears: Math.round(number(source.stressOwnershipYears, modelInput.ownershipYears, 1, 50)),
    stressAnnualUsage: number(source.stressAnnualUsage, modelInput.annualUsage * 1.2, 0, 100_000_000),
    stressCondition:
      source.stressCondition === "excellent" ||
      source.stressCondition === "good" ||
      source.stressCondition === "fair" ||
      source.stressCondition === "used" ||
      source.stressCondition === "serious"
        ? source.stressCondition
        : "used",
    includeDealerEconomics: source.includeDealerEconomics === true,
    dealerTradeAllowance: number(source.dealerTradeAllowance, modelInput.dealerOffer),
    dealerExpectedResale: number(source.dealerExpectedResale, modelInput.dealerOffer * 1.12),
    dealerReconCost: number(source.dealerReconCost, 0),
    dealerHoldingCost: number(source.dealerHoldingCost, 0),
    dealerGrossMarginPct: number(source.dealerGrossMarginPct, 20, 0, 100),
    dealerNewAssetProfit: number(source.dealerNewAssetProfit, 0),
    dealerRiskReserve: number(source.dealerRiskReserve, 0),
  };
}

function midpoint(base: number, stress: number): number {
  return (base + stress) / 2;
}

export function buildLifecycleReportContext(
  value: LifecycleReportRequest | unknown,
): LifecycleReportContext {
  const request = normalizeRequest(value);
  const model = buildLifecycleWorkspaceModel(request.modelInput);
  const preferred = model.scenarios.find((scenario) => scenario.id === request.preferredScenario) ?? model.scenarios[0];
  const nextCycle = calculateNextCycle({
    equity: preferred.equityAtDisposal,
    nextServicePlan: request.nextServiceAllocation,
    nextUptimeReserve: request.nextMaintenanceAllocation,
    currentNewPrice: model.future.startingPrice.grossAmount,
    inflationRatePct: model.input.assetInflationPct,
    years: model.input.ownershipYears,
  });
  const refinance = calculateRefinanceScenario({
    originalLoan: preferred.loanTerms,
    refinanceMonth: request.refinanceMonth,
    newAnnualRatePct: request.refinanceRatePct,
    newTermMonths: request.refinanceTermMonths,
    newBalloon: request.refinanceBalloon,
  });
  const conservativeInput: LifecycleModelInput = {
    ...model.input,
    annualRatePct: midpoint(model.input.annualRatePct, request.stressInterestRatePct),
    assetInflationPct: midpoint(model.input.assetInflationPct, request.stressAssetInflationPct),
    maintenanceInflationPct: midpoint(model.input.maintenanceInflationPct, request.stressMaintenanceInflationPct),
    tradeHaircutPct: midpoint(model.input.tradeHaircutPct, request.stressTradeHaircutPct),
    ownershipYears: Math.round(midpoint(model.input.ownershipYears, request.stressOwnershipYears)),
    annualUsage: midpoint(model.input.annualUsage, request.stressAnnualUsage),
    condition: model.input.condition === "excellent" ? "good" : model.input.condition === "good" ? "fair" : model.input.condition,
  };
  const stressInput: LifecycleModelInput = {
    ...model.input,
    annualRatePct: request.stressInterestRatePct,
    assetInflationPct: request.stressAssetInflationPct,
    maintenanceInflationPct: request.stressMaintenanceInflationPct,
    tradeHaircutPct: request.stressTradeHaircutPct,
    ownershipYears: request.stressOwnershipYears,
    annualUsage: request.stressAnnualUsage,
    condition: request.stressCondition,
  };
  const dealer = model.scenarios.map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
    result: calculateDealerEconomics({
      tradeAllowance: request.dealerTradeAllowance,
      expectedResalePrice: request.dealerExpectedResale,
      reconCost: request.dealerReconCost,
      holdingCost: request.dealerHoldingCost,
      servicePlanRevenue: scenario.serviceFinanced,
      uptimeReserveRevenue: scenario.maintenanceFinanced,
      grossMarginPct: request.dealerGrossMarginPct,
      newTractorGrossProfit: request.dealerNewAssetProfit,
      riskReserve: request.dealerRiskReserve,
    }),
  }));

  return {
    request,
    model,
    preferred,
    nextCycle,
    refinance,
    sensitivity: [
      { label: "Base", model },
      { label: "Conservative", model: buildLifecycleWorkspaceModel(conservativeInput) },
      { label: "Stress", model: buildLifecycleWorkspaceModel(stressInput) },
    ],
    dealer,
  };
}

function styled(value: XlsxPrimitiveCellValue, style: XlsxCellStyle): XlsxCellValue {
  return { value, style };
}

function formula(value: XlsxPrimitiveCellValue, expression: string, style: XlsxCellStyle): XlsxCellValue {
  return { value, formula: expression, style };
}

function pct(value: number): XlsxCellValue {
  return styled(value / 100, "percent");
}

function currency(value: number): XlsxCellValue {
  return styled(value, "currency");
}

function scenarioHeader(): XlsxCellValue[] {
  return [
    styled("Metric", "tableHeader"),
    styled("Standard", "tableHeader"),
    styled("Service Plan", "tableHeader"),
    styled("Service + Maintenance", "tableHeader"),
  ];
}

function comparisonRows(model: LifecycleWorkspaceModel): XlsxCellValue[][] {
  const [standard, service, full] = model.scenarios;
  const row = (label: string, values: XlsxCellValue[]): XlsxCellValue[] => [styled(label, "text"), ...values];
  return [
    scenarioHeader(),
    row("Asset incl. VAT", [currency(standard.assetAmount), currency(service.assetAmount), currency(full.assetAmount)]),
    row("Service provision financed", [currency(0), currency(service.serviceFinanced), currency(full.serviceFinanced)]),
    row("Maintenance provision financed", [currency(0), currency(0), currency(full.maintenanceFinanced)]),
    row("Finance fees", model.scenarios.map((scenario) => currency(scenario.financeFees))),
    row("Less deposit", model.scenarios.map((scenario) => currency(scenario.deposit))),
    row("Amount financed", model.scenarios.map((scenario) => currency(scenario.loan.principal))),
    row("Interest rate", model.scenarios.map(() => pct(model.input.annualRatePct))),
    row("Finance term (months)", model.scenarios.map((scenario) => styled(scenario.loan.termMonths, "integer"))),
    row("Effective balloon / residual", model.scenarios.map((scenario) => currency(scenario.loan.balloon))),
    row("Monthly instalment", model.scenarios.map((scenario) => currency(scenario.loan.monthlyPayment))),
    row("Total finance repayment", model.scenarios.map((scenario) => currency(scenario.loan.totalRepayment))),
    row("Total finance interest", model.scenarios.map((scenario) => currency(scenario.loan.totalInterest))),
    row("Future retail incl. VAT", model.scenarios.map(() => currency(model.future.projectedRetail.grossAmount))),
    row("Conservative trade value", model.scenarios.map(() => currency(model.future.tradeValue.grossAmount))),
    row("Settlement at disposal", model.scenarios.map((scenario) => currency(scenario.settlementAtDisposal))),
    row("Equity at disposal", model.scenarios.map((scenario) => currency(scenario.equityAtDisposal))),
    row("Total lifecycle cash requirement", model.scenarios.map((scenario) => currency(scenario.totalLifecycleCashRequirement))),
    row("Net ownership cost after trade", model.scenarios.map((scenario) => currency(scenario.netOwnershipCostAfterTrade))),
    row(`Cost per ${model.usageUnitLong}`, model.scenarios.map((scenario) => currency(scenario.costPerUsageUnit))),
    row("Finance premium for liquidity", model.scenarios.map((scenario) => currency(scenario.financePremiumForLiquidity))),
    row("Working capital protected", model.scenarios.map((scenario) => currency(scenario.workingCapitalProtected))),
    row("Cash-flow predictability", model.scenarios.map((scenario) => styled(scenario.predictability, "text"))),
  ];
}

function executiveSheet(context: LifecycleReportContext, generatedAt: Date): XlsxSheet {
  const { model, preferred, request } = context;
  const rows: XlsxCellValue[][] = [
    [styled("Aim4price Asset Lifecycle & Cash-Flow Model", "title"), "", "", ""],
    [styled(`${request.clientName || "Internal review"} • ${request.assetDescription || "Asset scenario"}`, "subtitle"), "", "", ""],
    [],
    [styled("Calculation date", "metaLabel"), styled(generatedAt, "date"), styled("VAT treatment", "metaLabel"), styled(request.modelInput.vatTreatment === "included" ? "VAT Included" : "VAT Excluded", "metaValue")],
    [styled("Preferred structure", "metaLabel"), styled(preferred.label, "metaValue"), styled("Usage basis", "metaLabel"), styled(model.input.usageBasis, "metaValue")],
    [],
    [styled("Executive comparison", "section"), "", "", ""],
    ...comparisonRows(model),
    [],
    [styled("Model checks", "section"), "", "", ""],
    [styled("Check", "tableHeader"), styled("Actual", "tableHeader"), styled("Expected", "tableHeader"), styled("Status", "tableHeader")],
    [styled("Package VAT ties", "text"), currency(model.packageVat.full.netAmount + model.packageVat.full.vatAmount), currency(model.packageVat.full.grossAmount), styled(Math.abs(model.packageVat.full.netAmount + model.packageVat.full.vatAmount - model.packageVat.full.grossAmount) < 0.02 ? "OK" : "REVIEW", "statusGood")],
    [styled("Service is not double counted when financed", "text"), currency(model.scenarios[1].cashFlow.reduce((sum, year) => sum + year.serviceCashPayments, 0)), currency(0), styled(model.scenarios[1].cashFlow.every((year) => year.serviceCashPayments === 0) ? "OK" : "REVIEW", "statusGood")],
    [styled("Maintenance is not double counted in Full", "text"), currency(model.scenarios[2].cashFlow.reduce((sum, year) => sum + year.maintenanceCashPayments, 0)), currency(0), styled(model.scenarios[2].cashFlow.every((year) => year.maintenanceCashPayments === 0) ? "OK" : "REVIEW", "statusGood")],
    [],
    [styled("Important", "section"), "", "", ""],
    [styled("This model is indicative financial advice support, not a lending decision, tax opinion, guaranteed valuation or refinance approval.", "note"), "", "", ""],
  ];
  return {
    name: "Executive Comparison",
    rows,
    columns: [38, 24, 24, 30],
    merges: [
      { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 4 },
      { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 4 },
      { fromRow: 7, fromColumn: 1, toRow: 7, toColumn: 4 },
      { fromRow: 31, fromColumn: 1, toRow: 31, toColumn: 4 },
      { fromRow: 37, fromColumn: 1, toRow: 37, toColumn: 4 },
      { fromRow: 38, fromColumn: 1, toRow: 38, toColumn: 4 },
    ],
    freezeRow: 8,
    tabColor: "10382F",
  };
}

function assumptionsSheet(context: LifecycleReportContext): XlsxSheet {
  const { model } = context;
  const input = model.input;
  const rows: XlsxCellValue[][] = [
    [styled("Lifecycle Model Assumptions", "title"), "", ""],
    [styled("Blue-style input convention: these are the values supplied to the live Aim4price model.", "subtitle"), "", ""],
    [],
    [styled("Section", "tableHeader"), styled("Assumption", "tableHeader"), styled("Value", "tableHeader")],
    [styled("Asset", "section"), styled("Starting price ex VAT", "text"), currency(model.future.startingPrice.netAmount)],
    [styled("Asset", "text"), styled("VAT", "text"), currency(model.future.startingPrice.vatAmount)],
    [styled("Asset", "text"), styled("Starting price incl. VAT", "text"), currency(model.future.startingPrice.grossAmount)],
    [styled("Asset", "text"), styled("VAT treatment", "text"), styled(input.vatTreatment, "text")],
    [styled("Asset", "text"), styled("VAT rate", "text"), pct(input.vatRatePct)],
    [styled("Asset", "text"), styled("Purchase year", "text"), styled(input.purchaseYear, "integer")],
    [styled("Asset", "text"), styled("Ownership years", "text"), styled(input.ownershipYears, "integer")],
    [styled("Asset", "text"), styled("Usage basis", "text"), styled(input.usageBasis, "text")],
    [styled("Asset", "text"), styled("Starting usage", "text"), styled(input.startingUsage, "decimal")],
    [styled("Asset", "text"), styled("Annual usage", "text"), styled(input.annualUsage, "decimal")],
    [styled("Asset", "text"), styled("Lifetime usage", "text"), styled(input.lifetimeUsage, "decimal")],
    [styled("Asset", "text"), styled("Life worked at disposal", "text"), pct(input.disposalLifeWorkedPct)],
    [styled("Asset", "text"), styled("Future condition", "text"), styled(input.condition, "text")],
    [styled("Asset", "text"), styled("Asset inflation", "text"), pct(input.assetInflationPct)],
    [styled("Finance", "section"), styled("Deposit", "text"), currency(input.deposit)],
    [styled("Finance", "text"), styled("Annual rate", "text"), pct(input.annualRatePct)],
    [styled("Finance", "text"), styled("Term months", "text"), styled(input.financeTermMonths, "integer")],
    [styled("Finance", "text"), styled("Entered balloon", "text"), currency(input.balloon)],
    [styled("Finance", "text"), styled("Fees", "text"), currency(input.financeFees)],
    [styled("Service", "section"), styled("Service basis", "text"), styled(input.serviceBasis, "text")],
    [styled("Service", "text"), styled("Service interval", "text"), styled(input.serviceInterval, "decimal")],
    [styled("Service", "text"), styled("Calendar interval months", "text"), styled(input.serviceCalendarIntervalMonths, "decimal")],
    [styled("Service", "text"), styled("Service count", "text"), styled(model.service.serviceCount, "integer")],
    [styled("Service", "text"), styled("Cost per service incl. VAT", "text"), currency(model.service.serviceCount > 0 ? model.service.calculated.grossAmount / model.service.serviceCount : 0)],
    [styled("Service", "text"), styled("Coverage years", "text"), styled(model.service.coverageYears, "decimal")],
    [styled("Service", "text"), styled("Calculated amount incl. VAT", "text"), currency(model.service.calculated.grossAmount)],
    [styled("Service", "text"), styled("Selected provision ex VAT", "text"), currency(model.service.selected.netAmount)],
    [styled("Service", "text"), styled("Selected provision VAT", "text"), currency(model.service.selected.vatAmount)],
    [styled("Service", "text"), styled("Selected provision incl. VAT", "text"), currency(model.service.selected.grossAmount)],
    [styled("Maintenance", "section"), styled("Start after years", "text"), styled(model.maintenance.startAfterYears, "decimal")],
    [styled("Maintenance", "text"), styled("Provision years", "text"), styled(model.maintenance.years, "decimal")],
    [styled("Maintenance", "text"), styled("Events per year", "text"), styled(input.maintenanceEventsPerYear, "decimal")],
    [styled("Maintenance", "text"), styled("Current cost per event incl. VAT", "text"), currency(model.maintenance.eventCount > 0 ? model.maintenance.currentMoneyRequirement.grossAmount / model.maintenance.eventCount : 0)],
    [styled("Maintenance", "text"), styled("Calculated current-money reserve", "text"), currency(model.maintenance.currentMoneyRequirement.grossAmount)],
    [styled("Maintenance", "text"), styled("Selected reserve ex VAT", "text"), currency(model.maintenance.selectedReserve.netAmount)],
    [styled("Maintenance", "text"), styled("Selected reserve VAT", "text"), currency(model.maintenance.selectedReserve.vatAmount)],
    [styled("Maintenance", "text"), styled("Selected reserve incl. VAT", "text"), currency(model.maintenance.selectedReserve.grossAmount)],
    [styled("Maintenance", "text"), styled("Maintenance inflation", "text"), pct(input.maintenanceInflationPct)],
    [styled("Full package", "section"), styled("Package ex VAT", "text"), currency(model.packageVat.full.netAmount)],
    [styled("Full package", "text"), styled("Package VAT", "text"), currency(model.packageVat.full.vatAmount)],
    [styled("Full package", "text"), styled("Package incl. VAT", "text"), currency(model.packageVat.full.grossAmount)],
    [styled("Trade", "section"), styled("Trade mode", "text"), styled(input.tradeMode, "text")],
    [styled("Trade", "text"), styled("Trade haircut", "text"), pct(input.tradeHaircutPct)],
    [styled("Trade", "text"), styled("Manual trade value", "text"), currency(input.manualTradeValue)],
    [styled("Trade", "text"), styled("Dealer offer", "text"), currency(input.dealerOffer)],
  ];
  return {
    name: "Assumptions",
    rows,
    columns: [18, 42, 24],
    freezeRow: 4,
    autoFilter: { fromRow: 4, fromColumn: 1, toRow: rows.length, toColumn: 3 },
    tabColor: "2E7D5B",
  };
}

function financeComparisonSheet(model: LifecycleWorkspaceModel): XlsxSheet {
  const rows: XlsxCellValue[][] = [
    [styled("Finance Comparison", "title"), "", "", ""],
    [styled("Formula-backed principal, payment, repayment and interest comparison", "subtitle"), "", "", ""],
    [],
    scenarioHeader(),
  ];
  const labels = [
    "Asset amount incl. VAT",
    "Service financed",
    "Maintenance financed",
    "Finance fees",
    "Less deposit",
    "Amount financed",
    "Annual rate",
    "Term months",
    "Effective balloon / residual",
    "Monthly payment",
    "Total payments",
    "Total interest",
    "Additional interest vs Standard",
    "Additional monthly vs Standard",
  ];
  labels.forEach((label, index) => {
    const rowNumber = index + 5;
    const values = model.scenarios.map((scenario, scenarioIndex): XlsxCellValue => {
      const column = String.fromCharCode(66 + scenarioIndex);
      if (rowNumber === 10) return formula(scenario.loan.principal, `MAX(0,${column}5+${column}6+${column}7+${column}8-${column}9)`, "currency");
      if (rowNumber === 14) return formula(scenario.loan.monthlyPayment, `-PMT(${column}11/12,${column}12,${column}10,-${column}13)`, "currency");
      if (rowNumber === 15) return formula(scenario.loan.totalRepayment, `${column}14*${column}12+${column}13`, "currency");
      if (rowNumber === 16) return formula(scenario.loan.totalInterest, `${column}15-${column}10`, "currency");
      if (rowNumber === 17) return formula(scenario.financePremiumForLiquidity, `${column}16-$B$16`, "currency");
      if (rowNumber === 18) return formula(scenario.additionalMonthlyPayment, `${column}14-$B$14`, "currency");
      const direct: Record<number, XlsxCellValue> = {
        5: currency(scenario.assetAmount),
        6: currency(scenario.serviceFinanced),
        7: currency(scenario.maintenanceFinanced),
        8: currency(scenario.financeFees),
        9: currency(scenario.deposit),
        11: pct(model.input.annualRatePct),
        12: styled(model.input.financeTermMonths, "integer"),
        13: currency(scenario.loan.balloon),
      };
      return direct[rowNumber] ?? styled("", "text");
    });
    rows.push([styled(label, "text"), ...values]);
  });
  return {
    name: "Finance Comparison",
    rows,
    columns: [38, 24, 24, 28],
    merges: [
      { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 4 },
      { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 4 },
    ],
    freezeRow: 4,
    tabColor: "176B4F",
  };
}

function cashFlowSheet(model: LifecycleWorkspaceModel): XlsxSheet {
  const headers = [
    "Year",
    "Standard Deposit",
    "Standard Finance",
    "Standard Service",
    "Standard Maintenance",
    "Standard Total",
    "Standard Cumulative",
    "Service Deposit",
    "Service Finance",
    "Service Maintenance",
    "Service Total",
    "Service Cumulative",
    "Full Deposit",
    "Full Finance",
    "Full Total",
    "Full Cumulative",
  ];
  const [standard, service, full] = model.scenarios;
  const rows: XlsxCellValue[][] = [
    [styled("Annual Cash-Flow Comparison", "title"), ...Array(headers.length - 1).fill("")],
    [styled("When cash leaves the business; a balloon settled from disposal proceeds is not counted twice", "subtitle"), ...Array(headers.length - 1).fill("")],
    [],
    headers.map((header) => styled(header, "tableHeader")),
    ...standard.cashFlow.map((standardYear, index) => {
      const serviceYear = service.cashFlow[index];
      const fullYear = full.cashFlow[index];
      return [
        styled(standardYear.year, "integer"),
        currency(standardYear.depositPayment),
        currency(standardYear.loanPayments),
        currency(standardYear.serviceCashPayments),
        currency(standardYear.maintenanceCashPayments),
        currency(standardYear.totalAnnualCash),
        currency(standardYear.cumulativeCash),
        currency(serviceYear.depositPayment),
        currency(serviceYear.loanPayments),
        currency(serviceYear.maintenanceCashPayments),
        currency(serviceYear.totalAnnualCash),
        currency(serviceYear.cumulativeCash),
        currency(fullYear.depositPayment),
        currency(fullYear.loanPayments),
        currency(fullYear.totalAnnualCash),
        currency(fullYear.cumulativeCash),
      ];
    }),
    [styled("Total", "tableHeader"), "", "", "", "", currency(standard.totalLifecycleCashRequirement), "", "", "", "", currency(service.totalLifecycleCashRequirement), "", "", "", currency(full.totalLifecycleCashRequirement), ""],
  ];
  return {
    name: "Cash Flow",
    rows,
    columns: [10, ...Array(15).fill(20)],
    merges: [
      { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: headers.length },
      { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: headers.length },
    ],
    freezeRow: 4,
    tabColor: "5D7F6B",
  };
}

function assetEquitySheet(model: LifecycleWorkspaceModel): XlsxSheet {
  const headers = [
    "Year",
    `Projected usage (${model.usageUnit})`,
    "Replacement ex VAT",
    "Replacement incl. VAT",
    "Asset inflation",
    "Age depreciation",
    "Usage depreciation",
    "Condition",
    "Retail ex VAT",
    "Retail incl. VAT",
    "Trade incl. VAT",
    "Settlement Standard",
    "Settlement Service",
    "Settlement Full",
    "Equity Standard",
    "Equity Service",
    "Equity Full",
  ];
  const rows: XlsxCellValue[][] = [
    [styled("Asset Value & Equity", "title"), ...Array(headers.length - 1).fill("")],
    [styled("Aim4price age, usage and condition depreciation with settlement by structure", "subtitle"), ...Array(headers.length - 1).fill("")],
    [],
    headers.map((header) => styled(header, "tableHeader")),
    ...model.timeline.map((year) => [
      styled(year.year, "integer"),
      styled(year.projectedUsage, "decimal"),
      currency(year.replacementPriceExVat),
      currency(year.replacementPriceInclVat),
      pct(model.input.assetInflationPct),
      pct(year.ageDepreciationPct),
      pct(year.usageDepreciationPct),
      styled(model.input.condition, "text"),
      currency(year.projectedRetailExVat),
      currency(year.projectedRetailInclVat),
      currency(year.projectedTradeInclVat),
      currency(year.settlementStandard),
      currency(year.settlementService),
      currency(year.settlementFull),
      currency(year.equityStandard),
      currency(year.equityService),
      currency(year.equityFull),
    ]),
  ];
  return {
    name: "Asset Value & Equity",
    rows,
    columns: [10, 22, ...Array(15).fill(21)],
    merges: [
      { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: headers.length },
      { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: headers.length },
    ],
    freezeRow: 4,
    tabColor: "6C8EA4",
  };
}

function serviceMaintenanceSheet(model: LifecycleWorkspaceModel): XlsxSheet {
  const headers = ["Year", "Projected usage", "Event type", "Expected events", "Current base cost", "Inflation factor", "Estimated future cost", "Standard cash", "Included in Service", "Included in Full"];
  const detailRows: XlsxCellValue[][] = [];
  model.timeline.slice(1).forEach((timelineYear, index) => {
    const serviceCost = model.service.payAsYouGoByYear[index] ?? 0;
    if (serviceCost > 0) {
      detailRows.push([
        styled(index + 1, "integer"), styled(timelineYear.projectedUsage, "decimal"), styled("Scheduled service", "text"), styled(model.service.servicesPerYear, "decimal"), currency(model.service.servicesPerYear * model.input.serviceCost), styled(serviceCost / Math.max(1, model.service.servicesPerYear * model.input.serviceCost), "decimal"), currency(serviceCost), currency(serviceCost), styled("Yes", "statusGood"), styled("Yes", "statusGood"),
      ]);
    }
    const maintenanceIndex = index - Math.round(model.maintenance.startAfterYears);
    const maintenanceCost = model.maintenance.payAsYouGoByYear[maintenanceIndex] ?? 0;
    if (maintenanceCost > 0) {
      detailRows.push([
        styled(index + 1, "integer"), styled(timelineYear.projectedUsage, "decimal"), styled("Maintenance / uptime", "text"), styled(model.input.maintenanceEventsPerYear, "decimal"), currency(model.input.maintenanceEventsPerYear * model.input.maintenanceCostPerEvent), styled(maintenanceCost / Math.max(1, model.input.maintenanceEventsPerYear * model.input.maintenanceCostPerEvent), "decimal"), currency(maintenanceCost), currency(maintenanceCost), styled("No", "statusWarn"), styled("Yes", "statusGood"),
      ]);
    }
  });
  const full = model.scenarios[2];
  const rows: XlsxCellValue[][] = [
    [styled("Service & Maintenance", "title"), ...Array(headers.length - 1).fill("")],
    [styled("Expected timing, inflation and funding treatment", "subtitle"), ...Array(headers.length - 1).fill("")],
    [],
    headers.map((header) => styled(header, "tableHeader")),
    ...detailRows,
    [],
    [styled("Summary", "section"), ...Array(headers.length - 1).fill("")],
    [styled("Service nominal future cost", "text"), currency(model.service.nominalPayAsYouGo)],
    [styled("Service fixed package", "text"), currency(model.service.selected.grossAmount)],
    [styled("Maintenance nominal future cost", "text"), currency(model.maintenance.nominalPayAsYouGo)],
    [styled("Maintenance fixed reserve", "text"), currency(model.maintenance.selectedReserve.grossAmount)],
    [styled("Maintenance inflation potentially avoided", "text"), currency(model.maintenance.inflationAvoided)],
    [styled("Finance interest premium on Full", "text"), currency(full.financePremiumForLiquidity)],
    [styled("Net inflation benefit / finance premium", "text"), currency(model.maintenance.inflationAvoided - full.financePremiumForLiquidity)],
  ];
  return {
    name: "Service & Maintenance",
    rows,
    columns: [10, 20, 28, 18, 20, 18, 22, 20, 20, 20],
    merges: [
      { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: headers.length },
      { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: headers.length },
      { fromRow: 6 + detailRows.length, fromColumn: 1, toRow: 6 + detailRows.length, toColumn: headers.length },
    ],
    freezeRow: 4,
    tabColor: "8A704C",
  };
}

function nextCycleSheet(context: LifecycleReportContext): XlsxSheet {
  const { preferred, nextCycle } = context;
  const rows: XlsxCellValue[][] = [
    [styled("Next Asset Cycle", "title"), ""],
    [styled(`Allocation based on ${preferred.label} equity at disposal`, "subtitle"), ""],
    [],
    [styled("Metric", "tableHeader"), styled("Value", "tableHeader")],
    [styled("Disposal trade value", "text"), currency(context.model.future.tradeValue.grossAmount)],
    [styled("Finance settlement", "text"), currency(preferred.settlementAtDisposal)],
    [styled("Available equity", "text"), currency(preferred.equityAtDisposal)],
    [styled("Negative equity shortfall", "text"), currency(nextCycle.negativeEquityShortfall)],
    [styled("Next service allocation", "text"), currency(nextCycle.serviceAllocation)],
    [styled("Next maintenance allocation", "text"), currency(nextCycle.reserveAllocation)],
    [styled("Remaining replacement deposit", "text"), currency(nextCycle.remainingDeposit)],
    [styled("Allocation shortfall", "text"), currency(nextCycle.allocationShortfall)],
    [styled("Next equivalent asset price", "text"), currency(nextCycle.nextAssetPrice)],
    [styled("Next financed amount", "text"), currency(nextCycle.nextFinancedAmount)],
  ];
  return {
    name: "Next Asset Cycle",
    rows,
    columns: [38, 24],
    merges: [
      { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 2 },
      { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 2 },
    ],
    freezeRow: 4,
    tabColor: "10382F",
  };
}

function refinanceStressSheet(context: LifecycleReportContext): XlsxSheet {
  const rows: XlsxCellValue[][] = [
    [styled("Refinance & Stress Test", "title"), "", "", ""],
    [styled("Optional restructure and deterministic scenario sensitivity", "subtitle"), "", "", ""],
    [],
    [styled("Refinance metric", "section"), styled("Value", "section"), "", ""],
    [styled("Review month", "text"), styled(context.request.refinanceMonth, "integer")],
    [styled("Settlement", "text"), currency(context.refinance.settlementAmount)],
    [styled("Current payment", "text"), currency(context.refinance.currentMonthlyPayment)],
    [styled("New payment", "text"), currency(context.refinance.newMonthlyPayment)],
    [styled("Monthly relief", "text"), currency(context.refinance.monthlyRelief)],
    [styled("New term months", "text"), styled(context.request.refinanceTermMonths, "integer")],
    [styled("New rate", "text"), pct(context.request.refinanceRatePct)],
    [styled("Additional total cost", "text"), currency(context.refinance.additionalCost)],
    [],
    [styled("Sensitivity metric", "tableHeader"), styled("Base", "tableHeader"), styled("Conservative", "tableHeader"), styled("Stress", "tableHeader")],
  ];
  const preferredId = context.preferred.id;
  const cases = context.sensitivity.map((entry) => ({
    ...entry,
    scenario: entry.model.scenarios.find((scenario) => scenario.id === preferredId) ?? entry.model.scenarios[0],
  }));
  const add = (label: string, getter: (entry: typeof cases[number]) => XlsxCellValue) => rows.push([styled(label, "text"), ...cases.map(getter)]);
  add("Monthly instalment", (entry) => currency(entry.scenario.loan.monthlyPayment));
  add("Future retail incl. VAT", (entry) => currency(entry.model.future.projectedRetail.grossAmount));
  add("Trade value", (entry) => currency(entry.model.future.tradeValue.grossAmount));
  add("Equity", (entry) => currency(entry.scenario.equityAtDisposal));
  add("Net ownership cost", (entry) => currency(entry.scenario.netOwnershipCostAfterTrade));
  rows.push([], [styled("Refinancing remains subject to lender approval, affordability, credit record, asset condition, valuation and prevailing rates.", "note"), "", "", ""]);
  return {
    name: "Refinance & Stress",
    rows,
    columns: [38, 24, 24, 24],
    merges: [
      { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 4 },
      { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 4 },
      { fromRow: rows.length, fromColumn: 1, toRow: rows.length, toColumn: 4 },
    ],
    freezeRow: 14,
    tabColor: "6C8EA4",
  };
}

function dealerSheet(context: LifecycleReportContext): XlsxSheet {
  const rows: XlsxCellValue[][] = [
    [styled("Internal Aim4price / Dealer Analysis", "title"), "", "", ""],
    [styled("Revenue is separated from gross contribution using the configured margin.", "subtitle"), "", "", ""],
    [],
    scenarioHeader(),
    [styled("New asset gross contribution", "text"), ...context.dealer.map((entry) => currency(entry.result.newTractorContribution))],
    [styled("Service / maintenance gross contribution", "text"), ...context.dealer.map((entry) => currency(entry.result.servicePartsContribution))],
    [styled("Trade contribution", "text"), ...context.dealer.map((entry) => currency(entry.result.tradeContribution))],
    [styled("Gross commercial contribution", "text"), ...context.dealer.map((entry) => currency(entry.result.totalGrossContribution))],
    [styled("Risk reserve", "text"), ...context.dealer.map((entry) => currency(entry.result.riskReserve))],
    [styled("Commercial buffer", "text"), ...context.dealer.map((entry) => currency(entry.result.commercialBuffer))],
  ];
  return {
    name: "Dealer Economics",
    rows,
    columns: [42, 22, 22, 28],
    merges: [
      { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 4 },
      { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 4 },
    ],
    freezeRow: 4,
    tabColor: "A3271B",
  };
}

export function buildLifecycleWorkbook(
  value: LifecycleReportRequest | unknown,
  generatedAt = new Date(),
): XlsxSheet[] {
  const context = buildLifecycleReportContext(value);
  const sheets: XlsxSheet[] = [
    executiveSheet(context, generatedAt),
    assumptionsSheet(context),
    financeComparisonSheet(context.model),
    cashFlowSheet(context.model),
    assetEquitySheet(context.model),
    serviceMaintenanceSheet(context.model),
    nextCycleSheet(context),
    refinanceStressSheet(context),
  ];
  if (context.request.includeDealerEconomics) sheets.push(dealerSheet(context));
  return sheets;
}

export function lifecycleWorkbookFileName(
  clientName: unknown,
  assetDescription: unknown,
  generatedAt = new Date(),
): string {
  const base = text(clientName, 60) || text(assetDescription, 60) || "Financial-Model";
  const slug = base
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "Financial-Model";
  return `Aim4price-Lifecycle-Model-${slug}-${generatedAt.toISOString().slice(0, 10)}.xlsx`;
}
