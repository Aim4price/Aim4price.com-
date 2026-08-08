"use client";

import { useMemo, useState } from "react";
import type { ConditionKey } from "../../../lib/tractor-data";
import { CONDITION_FACTORS } from "../../../lib/valuation/shared";
import {
  buildCashFlowScenarios,
  buildLifecycleTimeline,
  calculateDealerEconomics,
  calculateEquity,
  calculateFutureAssetValue,
  calculateInflatedEventSpend,
  calculateLoan,
  calculateNextCycle,
  calculateRefinanceScenario,
  calculateRemainingBalance,
  calculateServicePlan,
  calculateTradeValue,
  calculateUptimeReserve,
  type TradeMode,
} from "../../../lib/admin-lifecycle-calculator";
import styles from "./page.module.css";

type CalculatorState = {
  clientName: string;
  tractorDescription: string;
  dealerName: string;
  quoteReference: string;
  notes: string;
  tractorPrice: number;
  purchaseYear: number;
  startingHours: number;
  annualHours: number;
  expectedLifetimeHours: number;
  ownershipYears: number;
  condition: ConditionKey;
  replacementInflationPct: number;
  deposit: number;
  annualRatePct: number;
  termMonths: number;
  balloon: number;
  financeFees: number;
  packageOption: FinancePackage;
  serviceIntervalHours: number;
  serviceCost: number;
  servicePlanYears: number;
  negotiatedServicePlan: number;
  reserveMode: "calculated" | "fixed";
  reserveCostPerEvent: number;
  reserveEventsPerYear: number;
  postWarrantyYears: number;
  fixedReserveAmount: number;
  partsInflationPct: number;
  tradeMode: TradeMode;
  manualTradeValue: number;
  tradeHaircutPct: number;
  dealerOffer: number;
  refinanceMonth: number;
  refinanceRatePct: number;
  refinanceTermMonths: number;
  refinanceBalloon: number;
  nextServicePlan: number;
  nextReserve: number;
  dealerTradeAllowance: number;
  dealerExpectedResale: number;
  dealerReconCost: number;
  dealerHoldingCost: number;
  dealerGrossMarginPct: number;
  dealerNewTractorProfit: number;
  dealerRiskReserve: number;
};

type FinancePackage = "standard" | "service" | "full";
type ResultView = "summary" | "finance" | "depreciation" | "advanced";

const CURRENT_YEAR = new Date().getFullYear();

const INITIAL_STATE: CalculatorState = {
  clientName: "",
  tractorDescription: "",
  dealerName: "",
  quoteReference: "",
  notes: "",
  tractorPrice: 500_000,
  purchaseYear: CURRENT_YEAR,
  startingHours: 0,
  annualHours: 1_000,
  expectedLifetimeHours: 14_000,
  ownershipYears: 5,
  condition: "good",
  replacementInflationPct: 3,
  deposit: 0,
  annualRatePct: 10.5,
  termMonths: 60,
  balloon: 0,
  financeFees: 0,
  packageOption: "standard",
  serviceIntervalHours: 250,
  serviceCost: 8_000,
  servicePlanYears: 2,
  negotiatedServicePlan: 64_000,
  reserveMode: "fixed",
  reserveCostPerEvent: 4_000,
  reserveEventsPerYear: 4,
  postWarrantyYears: 3,
  fixedReserveAmount: 50_000,
  partsInflationPct: 3,
  tradeMode: "haircut",
  manualTradeValue: 260_000,
  tradeHaircutPct: 12,
  dealerOffer: 260_000,
  refinanceMonth: 36,
  refinanceRatePct: 10.5,
  refinanceTermMonths: 48,
  refinanceBalloon: 0,
  nextServicePlan: 64_000,
  nextReserve: 50_000,
  dealerTradeAllowance: 260_000,
  dealerExpectedResale: 290_000,
  dealerReconCost: 0,
  dealerHoldingCost: 0,
  dealerGrossMarginPct: 20,
  dealerNewTractorProfit: 0,
  dealerRiskReserve: 0,
};

const FLOW_STEPS = [
  {
    id: "asset",
    label: "Asset",
    title: "Tell us about the asset",
    description:
      "Start with the new asset price, expected usage, useful lifetime and how long it will be kept.",
  },
  {
    id: "finance",
    label: "Finance",
    title: "Choose the finance structure",
    description:
      "Choose standard finance or add service and maintenance, then enter the finance terms.",
  },
  {
    id: "service",
    label: "Service",
    title: "Add the service plan",
    description:
      "Set the scheduled dealer servicing included during the warranty period.",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    title: "Add the maintenance reserve",
    description:
      "Keep the post-warranty maintenance provision separate from scheduled servicing.",
  },
  {
    id: "depreciation",
    label: "Depreciation",
    title: "See how the asset value changes",
    description:
      "Aim4price combines age, projected hours and end condition to calculate future value and trade equity.",
  },
  {
    id: "results",
    label: "Results",
    title: "Lifecycle finance results",
    description:
      "Review the complete structure, compare cash flow and print the deal summary.",
  },
] as const;

const PACKAGE_OPTIONS: Array<{
  id: FinancePackage;
  label: string;
  description: string;
}> = [
  {
    id: "standard",
    label: "Standard finance",
    description: "Finance the asset only. Service and maintenance remain pay-as-you-go.",
  },
  {
    id: "service",
    label: "Add service plan",
    description: "Include the scheduled warranty service plan in the financed amount.",
  },
  {
    id: "full",
    label: "Add service + maintenance reserve",
    description: "Include scheduled servicing and a separate post-warranty maintenance reserve.",
  },
];

const CONDITION_OPTIONS: Array<{
  id: ConditionKey;
  label: string;
  description: string;
}> = [
  { id: "excellent", label: "Excellent", description: "Exceptional care and presentation" },
  { id: "good", label: "Good", description: "Normal wear with strong upkeep" },
  { id: "fair", label: "Fair", description: "Visible wear but fully usable" },
  { id: "used", label: "Used", description: "Heavy wear or repairs expected" },
  { id: "serious", label: "Serious attention", description: "Major work likely before resale" },
];

const integerRand = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

const preciseRand = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormat = new Intl.NumberFormat("en-ZA", {
  maximumFractionDigits: 1,
});

function rand(value: number): string {
  return integerRand.format(Number.isFinite(value) ? value : 0);
}

function randCents(value: number): string {
  return preciseRand.format(Number.isFinite(value) ? value : 0);
}

function NumericField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  max,
  step = 1,
  help,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  help?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.inputShell}>
        {prefix ? <b>{prefix}</b> : null}
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <b>{suffix}</b> : null}
      </div>
      {help ? <small>{help}</small> : null}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.inputShell}>
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  help?: string;
}) {
  return (
    <label className={styles.toggleRow}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{label}</strong>
        {help ? <small>{help}</small> : null}
      </span>
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "green" | "amber" | "red";
}) {
  return (
    <div className={`${styles.metric} ${tone ? styles[`metric${tone}`] : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export default function LifecycleCalculatorClient() {
  const [state, setState] = useState<CalculatorState>(INITIAL_STATE);
  const [activeStep, setActiveStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [includeDealerEconomics, setIncludeDealerEconomics] = useState(false);
  const [resultView, setResultView] = useState<ResultView>("summary");

  const flowSteps = useMemo(
    () =>
      FLOW_STEPS.filter((step) => {
        if (step.id === "service") return state.packageOption !== "standard";
        if (step.id === "maintenance") return state.packageOption === "full";
        return true;
      }),
    [state.packageOption],
  );
  const resultsStep = flowSteps.length - 1;
  const currentStep = flowSteps[activeStep] ?? flowSteps[0];
  const activeStepId = currentStep.id;
  const includesService = state.packageOption !== "standard";
  const includesMaintenance = state.packageOption === "full";
  const selectedPackage =
    PACKAGE_OPTIONS.find((option) => option.id === state.packageOption) ??
    PACKAGE_OPTIONS[0];
  const expectedPaymentEndYear =
    Math.round(state.purchaseYear) + Math.ceil(state.termMonths / 12);

  function update<K extends keyof CalculatorState>(
    key: K,
    value: CalculatorState[K],
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function updateOwnershipHorizon(value: number) {
    const years = Math.max(1, value);
    setState((current) => ({
      ...current,
      ownershipYears: years,
      termMonths: Math.max(1, Math.round(years * 12)),
    }));
  }

  function moveToStep(step: number) {
    const nextStep = Math.min(resultsStep, Math.max(0, step));
    setActiveStep(nextStep);
    setFurthestStep((current) => Math.max(current, nextStep));
    if (flowSteps[nextStep]?.id === "results") {
      setResultView("summary");
    }
    window.requestAnimationFrame(() => {
      document
        .getElementById("lifecycle-calculator-flow")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function startNewCalculation() {
    if (!window.confirm("Start a new calculation and reset these values?")) {
      return;
    }

    setState(INITIAL_STATE);
    setIncludeDealerEconomics(false);
    setResultView("summary");
    setFurthestStep(0);
    moveToStep(0);
  }

  const stepIsValid =
    activeStepId === "asset"
      ? state.tractorPrice > 0 &&
        state.purchaseYear >= 2000 &&
        state.expectedLifetimeHours > 0 &&
        state.ownershipYears > 0 &&
        state.annualHours >= 0
      : activeStepId === "finance"
        ? state.termMonths > 0 &&
          state.annualRatePct >= 0 &&
          state.deposit >= 0 &&
          state.balloon >= 0
        : activeStepId === "service"
          ? state.serviceIntervalHours > 0 &&
            state.serviceCost >= 0
          : activeStepId === "maintenance"
            ? state.reserveCostPerEvent >= 0 &&
            state.reserveEventsPerYear >= 0 &&
            state.postWarrantyYears >= 0
            : true;

  const model = useMemo(() => {
    const servicePlan = calculateServicePlan({
      serviceIntervalHours: state.serviceIntervalHours,
      expectedAnnualHours: state.annualHours,
      costPerService: state.serviceCost,
      planYears: state.servicePlanYears,
      negotiatedAmount: state.negotiatedServicePlan,
    });
    const reserve = calculateUptimeReserve({
      mode: state.reserveMode,
      costPerEvent: state.reserveCostPerEvent,
      eventsPerYear: state.reserveEventsPerYear,
      postWarrantyYears: state.postWarrantyYears,
      fixedAmount: state.fixedReserveAmount,
    });
    const rawPackage =
      state.tractorPrice +
      (includesService ? servicePlan.packageAmount : 0) +
      (includesMaintenance ? reserve.packageAmount : 0) +
      state.financeFees;
    const packagePrincipal = Math.max(0, rawPackage - state.deposit);
    const loanTerms = {
      principal: packagePrincipal,
      annualRatePct: state.annualRatePct,
      termMonths: state.termMonths,
      balloon: state.balloon,
    };
    const packageLoan = calculateLoan(loanTerms);
    const tractorOnlyLoan = calculateLoan({
      ...loanTerms,
      principal: Math.max(
        0,
        state.tractorPrice + state.financeFees - state.deposit,
      ),
    });
    const tractorServiceLoan = calculateLoan({
      ...loanTerms,
      principal: Math.max(
        0,
        state.tractorPrice +
          servicePlan.packageAmount +
          state.financeFees -
          state.deposit,
      ),
    });
    const fullPackageLoan = calculateLoan({
      ...loanTerms,
      principal: Math.max(
        0,
        state.tractorPrice +
          servicePlan.packageAmount +
          reserve.packageAmount +
          state.financeFees -
          state.deposit,
      ),
    });
    const serviceFinance = calculateLoan({
      principal: servicePlan.packageAmount,
      annualRatePct: state.annualRatePct,
      termMonths: state.termMonths,
      balloon: 0,
    });
    const reserveFinance = calculateLoan({
      principal: reserve.packageAmount,
      annualRatePct: state.annualRatePct,
      termMonths: state.termMonths,
      balloon: 0,
    });
    const feeFinance = calculateLoan({
      principal: state.financeFees,
      annualRatePct: state.annualRatePct,
      termMonths: state.termMonths,
      balloon: 0,
    });
    const tractorContribution = Math.max(
      0,
      packageLoan.monthlyPayment -
        (includesService ? serviceFinance.monthlyPayment : 0) -
        (includesMaintenance ? reserveFinance.monthlyPayment : 0) -
        feeFinance.monthlyPayment,
    );
    const targetYear = state.purchaseYear + state.ownershipYears;
    const futureValue = calculateFutureAssetValue({
      newPrice: state.tractorPrice,
      purchaseYear: state.purchaseYear,
      targetYear,
      startingHours: state.startingHours,
      expectedAnnualHours: state.annualHours,
      lifetimeHours: state.expectedLifetimeHours,
      condition: state.condition,
      inflationRatePct: state.replacementInflationPct,
    });
    const conditionValues = CONDITION_OPTIONS.map((option) => ({
      ...option,
      factor: CONDITION_FACTORS[option.id],
      value: calculateFutureAssetValue({
        newPrice: state.tractorPrice,
        purchaseYear: state.purchaseYear,
        targetYear,
        startingHours: state.startingHours,
        expectedAnnualHours: state.annualHours,
        lifetimeHours: state.expectedLifetimeHours,
        condition: option.id,
        inflationRatePct: state.replacementInflationPct,
      }).estimatedRetailValue,
    }));
    const trade = calculateTradeValue({
      mode: state.tradeMode,
      projectedRetailValue: futureValue.estimatedRetailValue,
      manualValue: state.manualTradeValue,
      haircutPct: state.tradeHaircutPct,
      dealerOffer: state.dealerOffer,
    });
    const ownershipMonths = Math.min(
      state.termMonths,
      state.ownershipYears * 12,
    );
    const settlementAtTrade = calculateRemainingBalance(
      loanTerms,
      ownershipMonths,
    );
    const equity = calculateEquity(trade.tradeValue, settlementAtTrade);
    const refinance = calculateRefinanceScenario({
      originalLoan: loanTerms,
      refinanceMonth: state.refinanceMonth,
      newAnnualRatePct: state.refinanceRatePct,
      newTermMonths: state.refinanceTermMonths,
      newBalloon: state.refinanceBalloon,
    });
    const nextCycle = calculateNextCycle({
      equity,
      nextServicePlan: state.nextServicePlan,
      nextUptimeReserve: state.nextReserve,
      currentNewPrice: state.tractorPrice,
      inflationRatePct: state.replacementInflationPct,
      years: state.ownershipYears,
    });
    const reservePayAsYouGo = calculateInflatedEventSpend({
      costPerEvent: state.reserveCostPerEvent,
      eventsPerYear: state.reserveEventsPerYear,
      years: state.postWarrantyYears,
      annualInflationPct: state.partsInflationPct,
      startAfterYears: state.servicePlanYears,
    });
    const servicePayAsYouGo = calculateInflatedEventSpend({
      costPerEvent: state.serviceCost,
      eventsPerYear: servicePlan.servicesPerYear,
      years: state.servicePlanYears,
      annualInflationPct: state.partsInflationPct,
    });
    const inflationAvoided =
      reservePayAsYouGo.total - reserve.packageAmount;
    const reserveNetBenefit = inflationAvoided - reserveFinance.totalInterest;
    const cashFlows = buildCashFlowScenarios({
      tractorPrice: state.tractorPrice,
      deposit: state.deposit,
      fees: state.financeFees,
      annualRatePct: state.annualRatePct,
      termMonths: state.termMonths,
      balloon: state.balloon,
      horizonYears: state.ownershipYears,
      servicePlan,
      servicePlanYears: state.servicePlanYears,
      serviceCostPerEvent: state.serviceCost,
      reserve,
      reserveCostPerEvent: state.reserveCostPerEvent,
      reserveEventsPerYear: state.reserveEventsPerYear,
      postWarrantyYears: state.postWarrantyYears,
      partsInflationPct: state.partsInflationPct,
    });
    const selectedScenarioId =
      state.packageOption === "full"
        ? "full"
        : state.packageOption === "service"
          ? "service"
          : "tractor";
    const selectedCashFlow = cashFlows.find(
      (scenario) => scenario.id === selectedScenarioId,
    );
    const plannedMaintenanceByYear =
      selectedCashFlow?.years.map(
        (year) => year.serviceCashPayments + year.maintenanceCashPayments,
      ) ?? [];
    const timeline = buildLifecycleTimeline({
      futureValue: {
        newPrice: state.tractorPrice,
        purchaseYear: state.purchaseYear,
        startingHours: state.startingHours,
        expectedAnnualHours: state.annualHours,
        lifetimeHours: state.expectedLifetimeHours,
        condition: state.condition,
        inflationRatePct: state.replacementInflationPct,
      },
      horizonYears: state.ownershipYears,
      loan: loanTerms,
      trade: {
        mode: state.tradeMode,
        manualValue: state.manualTradeValue,
        haircutPct: state.tradeHaircutPct,
        dealerOffer: state.dealerOffer,
      },
      finalTradeValue: trade.tradeValue,
      finalRetailValue: futureValue.estimatedRetailValue,
      plannedMaintenanceByYear,
    });
    const dealer = calculateDealerEconomics({
      tradeAllowance: state.dealerTradeAllowance,
      expectedResalePrice: state.dealerExpectedResale,
      reconCost: state.dealerReconCost,
      holdingCost: state.dealerHoldingCost,
      servicePlanRevenue: servicePlan.packageAmount,
      uptimeReserveRevenue: reserve.packageAmount,
      grossMarginPct: state.dealerGrossMarginPct,
      newTractorGrossProfit: state.dealerNewTractorProfit,
      riskReserve: state.dealerRiskReserve,
    });
    const hoursAdded = Math.max(
      1,
      futureValue.expectedHours - state.startingHours,
    );
    const cashMaintenance =
      (includesService ? 0 : servicePayAsYouGo.total) +
      (includesMaintenance ? 0 : reservePayAsYouGo.total);
    const netOwnershipCost =
      packageLoan.totalRepayment + cashMaintenance - trade.tradeValue;
    const maintenanceFinancePremium =
      (includesService ? serviceFinance.totalInterest : 0) +
      (includesMaintenance ? reserveFinance.totalInterest : 0);

    return {
      servicePlan,
      reserve,
      packageLoan,
      tractorOnlyLoan,
      tractorServiceLoan,
      fullPackageLoan,
      serviceFinance,
      reserveFinance,
      feeFinance,
      tractorContribution,
      futureValue,
      conditionValues,
      trade,
      settlementAtTrade,
      equity,
      refinance,
      nextCycle,
      reservePayAsYouGo,
      servicePayAsYouGo,
      inflationAvoided,
      reserveNetBenefit,
      cashFlows,
      timeline,
      dealer,
      maintenanceFinancePremium,
      netOwnershipCost,
      averageMonthlyOwnershipCost:
        netOwnershipCost / Math.max(1, state.ownershipYears * 12),
      costPerOperatingHour: netOwnershipCost / hoursAdded,
      additionalCostPerHour: maintenanceFinancePremium / hoursAdded,
    };
  }, [includesMaintenance, includesService, state]);

  return (
    <div
      id="lifecycle-calculator-flow"
      className={styles.calculator}
      data-active-step={activeStepId}
    >
      <section className={styles.flowHeader} aria-label="Calculator progress">
        <div className={styles.flowProgressCopy}>
          <span>
            {activeStepId === "results"
              ? "Calculation complete"
              : `Step ${activeStep + 1} of ${resultsStep}`}
          </span>
          <strong>{currentStep.label}</strong>
        </div>
        <div className={styles.flowProgressTrack} aria-hidden="true">
          <i
            style={{
              width: `${Math.max(
                4,
                (activeStep / resultsStep) * 100,
              )}%`,
            }}
          />
        </div>
        <ol className={styles.flowSteps}>
          {flowSteps.map((step, index) => {
            const isAvailable = index <= furthestStep;
            const isActive = index === activeStep;
            const isComplete = index < activeStep || index < furthestStep;

            return (
              <li key={step.label}>
                <button
                  type="button"
                  className={`${isActive ? styles.flowStepActive : ""} ${
                    isComplete ? styles.flowStepComplete : ""
                  }`}
                  disabled={!isAvailable}
                  onClick={() => moveToStep(index)}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span>{isComplete ? "✓" : index + 1}</span>
                  <strong>{step.label}</strong>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section
        className={styles.flowIntro}
        hidden={activeStepId === "results"}
      >
        <p className={styles.eyebrow}>Guided lifecycle calculation</p>
        <h2>{currentStep.title}</h2>
        <p>{currentStep.description}</p>
      </section>

      <aside
        className={styles.summaryPanel}
        aria-label="Deal summary"
        hidden={activeStepId !== "results"}
      >
        <div className={styles.summaryHeading}>
          <div>
            <p className={styles.eyebrow}>Lifecycle results</p>
            <h2>{state.tractorDescription || "New asset scenario"}</h2>
            <span>
              {state.clientName || "Pre-purchase scenario"} · {state.ownershipYears}
              -year ownership plan · {selectedPackage.label}
            </span>
          </div>
          <div className={styles.summaryActions}>
            <button
              type="button"
              className={styles.secondaryFlowButton}
              onClick={() => moveToStep(0)}
            >
              Edit inputs
            </button>
            <button
              type="button"
              className={styles.printButton}
              onClick={() => window.print()}
            >
              Print / Deal Summary
            </button>
          </div>
        </div>

        <div className={styles.summaryGrid}>
          <Metric label="New asset" value={rand(state.tractorPrice)} />
          <Metric
            label="Expected payment end"
            value={String(expectedPaymentEndYear)}
            detail={`${state.termMonths} month finance term`}
          />
          <Metric
            label="Selected financed package"
            value={rand(model.packageLoan.principal)}
          />
          <Metric
            label="Monthly instalment"
            value={rand(model.packageLoan.monthlyPayment)}
            tone="green"
          />
          <Metric
            label="Total interest"
            value={rand(model.packageLoan.totalInterest)}
          />
          <Metric
            label="Projected future retail"
            value={rand(model.futureValue.estimatedRetailValue)}
          />
          <Metric
            label="Value reduction after depreciation"
            value={rand(
              Math.max(
                0,
                model.futureValue.projectedReplacementPrice -
                  model.futureValue.estimatedRetailValue,
              ),
            )}
            detail={`${model.futureValue.averageDepreciationPct}% age-and-hours depreciation, then ${Math.round(model.futureValue.conditionFactor * 100)}% condition factor`}
          />
          <Metric
            label="Conservative trade assumption"
            value={rand(model.trade.tradeValue)}
          />
          <Metric
            label="Estimated equity at trade"
            value={rand(model.equity)}
            tone={model.equity >= 0 ? "green" : "red"}
          />
          <Metric
            label="Net ownership cost after trade"
            value={rand(model.netOwnershipCost)}
          />
          <Metric
            label="Cost per operating hour"
            value={randCents(model.costPerOperatingHour)}
          />
        </div>
        {state.dealerName || state.quoteReference || state.notes ? (
          <div className={styles.resultMeta}>
            {state.dealerName ? (
              <span>
                <b>Dealer</b>
                {state.dealerName}
              </span>
            ) : null}
            {state.quoteReference ? (
              <span>
                <b>Quote reference</b>
                {state.quoteReference}
              </span>
            ) : null}
            {state.notes ? (
              <span>
                <b>Notes</b>
                {state.notes}
              </span>
            ) : null}
          </div>
        ) : null}
      </aside>

      <nav
        className={styles.resultTabs}
        aria-label="Result sections"
        hidden={activeStepId !== "results"}
      >
        {([
          ["summary", "Summary"],
          ["finance", "Finance"],
          ["depreciation", "Depreciation & trade"],
          ["advanced", "Advanced"],
        ] as Array<[ResultView, string]>).map(([view, label]) => (
          <button
            key={view}
            type="button"
            className={resultView === view ? styles.resultTabActive : ""}
            onClick={() => setResultView(view)}
            aria-pressed={resultView === view}
          >
            {label}
          </button>
        ))}
      </nav>

      <section
        className={styles.resultSnapshot}
        hidden={activeStepId !== "results" || resultView !== "summary"}
      >
        <article>
          <p className={styles.eyebrow}>Selected finance package</p>
          <h2>{selectedPackage.label}</h2>
          <div className={styles.resultLines}>
            <div><span>Asset</span><strong>{rand(state.tractorPrice)}</strong></div>
            {includesService ? <div><span>Service plan</span><strong>{rand(model.servicePlan.packageAmount)}</strong></div> : null}
            {includesMaintenance ? <div><span>Maintenance reserve</span><strong>{rand(model.reserve.packageAmount)}</strong></div> : null}
            {state.financeFees > 0 ? <div><span>Finance fees</span><strong>{rand(state.financeFees)}</strong></div> : null}
            {state.deposit > 0 ? <div><span>Less deposit</span><strong>− {rand(state.deposit)}</strong></div> : null}
            <div className={styles.resultLineTotal}><span>Financed amount</span><strong>{rand(model.packageLoan.principal)}</strong></div>
          </div>
          <div className={styles.resultHeroValue}>
            <span>Estimated monthly instalment</span>
            <strong>{randCents(model.packageLoan.monthlyPayment)}</strong>
          </div>
        </article>

        <article>
          <p className={styles.eyebrow}>Aim4price future value</p>
          <h2>{numberFormat.format(model.futureValue.expectedHours)} hours after {state.ownershipYears} years</h2>
          <div className={styles.resultLines}>
            <div><span>Projected replacement price</span><strong>{rand(model.futureValue.projectedReplacementPrice)}</strong></div>
            <div><span>Age depreciation</span><strong>{model.futureValue.ageDepreciationPct}%</strong></div>
            <div><span>Usage depreciation</span><strong>{numberFormat.format(model.futureValue.usageDepreciationPct)}%</strong></div>
            <div><span>Combined depreciation</span><strong>{model.futureValue.averageDepreciationPct}%</strong></div>
            <div><span>{CONDITION_OPTIONS.find((option) => option.id === state.condition)?.label} condition factor</span><strong>{Math.round(model.futureValue.conditionFactor * 100)}%</strong></div>
            <div className={styles.resultLineTotal}><span>Estimated future retail</span><strong>{rand(model.futureValue.estimatedRetailValue)}</strong></div>
          </div>
          <div className={styles.resultHeroValue}>
            <span>Estimated trade equity</span>
            <strong>{rand(model.equity)}</strong>
          </div>
        </article>
      </section>

      <div className={styles.contentGrid}>
        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={activeStepId !== "asset"}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Asset</h2>
              <p>Start with the negotiated new price and expected working life.</p>
            </div>
          </div>
          <div className={styles.formGrid}>
            <NumericField
              label="New asset price"
              value={state.tractorPrice}
              onChange={(value) => update("tractorPrice", value)}
              prefix="R"
              step={1_000}
            />
            <NumericField
              label="Purchase year"
              value={state.purchaseYear}
              onChange={(value) => update("purchaseYear", value)}
              min={2000}
              max={CURRENT_YEAR + 5}
            />
            <NumericField
              label="Starting hours"
              value={state.startingHours}
              onChange={(value) => update("startingHours", value)}
              suffix="h"
            />
            <NumericField
              label="Expected annual hours"
              value={state.annualHours}
              onChange={(value) => update("annualHours", value)}
              suffix="h/year"
              step={100}
            />
            <NumericField
              label="Expected lifetime"
              value={state.expectedLifetimeHours}
              onChange={(value) => update("expectedLifetimeHours", value)}
              suffix="hours"
              min={1}
              step={500}
              help="Editable for the specific asset and its expected working life."
            />
            <NumericField
              label="Ownership horizon"
              value={state.ownershipYears}
              onChange={updateOwnershipHorizon}
              suffix="years"
              min={1}
              max={15}
            />
            <label className={styles.field}>
              <span>Expected end-of-payment year</span>
              <div className={`${styles.inputShell} ${styles.calculatedInput}`}>
                <output>{expectedPaymentEndYear}</output>
              </div>
              <small>Automatically follows the ownership horizon and updates if the finance term changes.</small>
            </label>
          </div>
          <div className={styles.assetProjection}>
            <div>
              <span>Expected hours at end</span>
              <strong>{numberFormat.format(model.futureValue.expectedHours)} h</strong>
            </div>
            <div>
              <span>Expected lifetime</span>
              <strong>{numberFormat.format(state.expectedLifetimeHours)} h</strong>
            </div>
            <div>
              <span>Payment end year</span>
              <strong>{expectedPaymentEndYear}</strong>
            </div>
          </div>
        </section>

        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={activeStepId !== "finance"}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Finance</h2>
              <p>Standard monthly amortising finance with an optional balloon.</p>
            </div>
          </div>
          <div className={styles.financePackagePicker}>
            <label className={styles.field}>
              <span>Finance option</span>
              <div className={styles.inputShell}>
                <select
                  value={state.packageOption}
                  onChange={(event) =>
                    update("packageOption", event.target.value as FinancePackage)
                  }
                >
                  {PACKAGE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <div>
              <strong>{selectedPackage.label}</strong>
              <span>{selectedPackage.description}</span>
              <small>
                {includesService ? `${rand(model.servicePlan.packageAmount)} service plan` : "No service plan"}
                {includesMaintenance ? ` · ${rand(model.reserve.packageAmount)} maintenance reserve` : ""}
              </small>
            </div>
          </div>
          <div className={styles.formGrid}>
            <NumericField
              label="Deposit"
              value={state.deposit}
              onChange={(value) => update("deposit", value)}
              prefix="R"
              step={1_000}
            />
            <NumericField
              label="Annual interest rate"
              value={state.annualRatePct}
              onChange={(value) => update("annualRatePct", value)}
              suffix="%"
              step={0.1}
            />
            <NumericField
              label="Finance term"
              value={state.termMonths}
              onChange={(value) => update("termMonths", value)}
              suffix="months"
              min={1}
              max={180}
            />
            <NumericField
              label="Balloon / residual"
              value={state.balloon}
              onChange={(value) => update("balloon", value)}
              prefix="R"
              step={1_000}
            />
            <NumericField
              label="Initiation / finance fees"
              value={state.financeFees}
              onChange={(value) => update("financeFees", value)}
              prefix="R"
            />
          </div>
          <div className={styles.financePreview}>
            <div>
              <span>{selectedPackage.label}</span>
              <strong>{rand(model.packageLoan.principal)} financed</strong>
            </div>
            <div>
              <span>Estimated instalment</span>
              <strong>{randCents(model.packageLoan.monthlyPayment)} / month</strong>
            </div>
          </div>
          <div className={styles.stepNote}>
            <strong>The full result stays separate.</strong>
            <span>Continue through the selected package and depreciation assumptions before reviewing the result.</span>
          </div>
        </section>

        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={activeStepId !== "service"}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Warranty Service Plan</h2>
              <p>Scheduled dealer servicing during the warranty period.</p>
            </div>
          </div>
          <div className={styles.formGrid}>
            <NumericField
              label="Service interval"
              value={state.serviceIntervalHours}
              onChange={(value) => update("serviceIntervalHours", value)}
              suffix="hours"
            />
            <NumericField
              label="Cost per dealer service"
              value={state.serviceCost}
              onChange={(value) => update("serviceCost", value)}
              prefix="R"
            />
            <NumericField
              label="Warranty / plan period"
              value={state.servicePlanYears}
              onChange={(value) => update("servicePlanYears", value)}
              suffix="years"
            />
            <NumericField
              label="Negotiated service-plan amount"
              value={state.negotiatedServicePlan}
              onChange={(value) => update("negotiatedServicePlan", value)}
              prefix="R"
              help="Set this to the dealer's agreed fixed amount."
            />
          </div>
          <div className={styles.splitResult}>
            <Metric
              label={`${model.servicePlan.serviceCount} calculated services`}
              value={rand(model.servicePlan.calculatedAmount)}
              detail={`${model.servicePlan.servicesPerYear} services per year`}
            />
            <Metric
              label="Negotiated package"
              value={rand(model.servicePlan.packageAmount)}
            />
            <Metric
              label="Added to monthly instalment"
              value={randCents(model.serviceFinance.monthlyPayment)}
              detail="This service plan is included because of the selected package."
              tone="green"
            />
          </div>
          <div className={styles.includedBanner}>
            <span>✓</span>
            <div>
              <strong>Service plan included</strong>
              <small>{rand(model.servicePlan.packageAmount)} is added to the financed package.</small>
            </div>
          </div>
        </section>

        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={activeStepId !== "maintenance"}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Uptime &amp; Maintenance Reserve</h2>
              <p>Provision for approved post-warranty parts and maintenance.</p>
            </div>
          </div>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Calculation mode</span>
              <div className={styles.inputShell}>
                <select
                  value={state.reserveMode}
                  onChange={(event) =>
                    update(
                      "reserveMode",
                      event.target.value as CalculatorState["reserveMode"],
                    )
                  }
                >
                  <option value="calculated">Calculated reserve</option>
                  <option value="fixed">Fixed negotiated package</option>
                </select>
              </div>
            </label>
            <NumericField
              label="Expected cost per event"
              value={state.reserveCostPerEvent}
              onChange={(value) => update("reserveCostPerEvent", value)}
              prefix="R"
            />
            <NumericField
              label="Service events per year"
              value={state.reserveEventsPerYear}
              onChange={(value) => update("reserveEventsPerYear", value)}
              step={0.5}
            />
            <NumericField
              label="Post-warranty years"
              value={state.postWarrantyYears}
              onChange={(value) => update("postWarrantyYears", value)}
              suffix="years"
            />
            <NumericField
              label="Fixed dealer package"
              value={state.fixedReserveAmount}
              onChange={(value) => update("fixedReserveAmount", value)}
              prefix="R"
              help="Used when Fixed negotiated package is selected."
            />
            <NumericField
              label="Annual parts inflation"
              value={state.partsInflationPct}
              onChange={(value) => update("partsInflationPct", value)}
              suffix="%"
              step={0.1}
            />
          </div>
          <div className={styles.splitResult}>
            <Metric
              label={`${model.reserve.eventCount} calculated events`}
              value={rand(model.reserve.calculatedAmount)}
            />
            <Metric label="Selected reserve" value={rand(model.reserve.packageAmount)} />
            <Metric
              label="Added to monthly instalment"
              value={randCents(model.reserveFinance.monthlyPayment)}
              detail="The maintenance reserve remains separate from the service plan."
              tone="green"
            />
          </div>
          <div className={styles.includedBanner}>
            <span>✓</span>
            <div>
              <strong>Maintenance reserve included</strong>
              <small>{rand(model.reserve.packageAmount)} is added separately to the financed package.</small>
            </div>
          </div>
          <div className={styles.principleNote}>
            <strong>Transparent trade-off</strong>
            <p>
              Financing this reserve improves cash-flow predictability, but it
              increases total interest and repayments may continue after some
              maintenance has already been consumed.
            </p>
          </div>
        </section>

        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={activeStepId !== "results" || resultView !== "finance"}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Complete Package</h2>
              <p>See exactly what each layer adds to the monthly instalment.</p>
            </div>
          </div>
          <div className={styles.packageGrid}>
            <article className={state.packageOption === "standard" ? styles.packagePrimary : ""}>
              <span>Base asset only</span>
              <strong>{rand(state.tractorPrice)}</strong>
              <small>{randCents(model.tractorOnlyLoan.monthlyPayment)} / month</small>
            </article>
            <article className={state.packageOption === "service" ? styles.packagePrimary : ""}>
              <span>Asset + warranty servicing</span>
              <strong>{rand(state.tractorPrice + model.servicePlan.packageAmount)}</strong>
              <small>{randCents(model.tractorServiceLoan.monthlyPayment)} / month</small>
            </article>
            <article className={state.packageOption === "full" ? styles.packagePrimary : ""}>
              <span>Full lifecycle package</span>
              <strong>
                {rand(
                  state.tractorPrice +
                    model.servicePlan.packageAmount +
                    model.reserve.packageAmount,
                )}
              </strong>
              <small>{randCents(model.fullPackageLoan.monthlyPayment)} / month</small>
            </article>
          </div>
          <div className={styles.contributionBar} aria-label="Monthly instalment breakdown">
            <div>
              <span>Asset</span>
              <strong>{randCents(model.tractorContribution)}</strong>
            </div>
            <div>
              <span>Service plan</span>
              <strong>
                {includesService
                  ? randCents(model.serviceFinance.monthlyPayment)
                  : "Not financed"}
              </strong>
            </div>
            <div>
              <span>Uptime reserve</span>
              <strong>
                {includesMaintenance
                  ? randCents(model.reserveFinance.monthlyPayment)
                  : "Not financed"}
              </strong>
            </div>
            <div>
              <span>Fees</span>
              <strong>{randCents(model.feeFinance.monthlyPayment)}</strong>
            </div>
          </div>
        </section>

        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={activeStepId !== "results" || resultView !== "finance"}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Cash-Flow Comparison</h2>
              <p>Cheapest total cost and best cash-flow predictability are not the same decision.</p>
            </div>
          </div>
          <div className={styles.scenarioGrid}>
            {model.cashFlows.map((scenario) => (
              <article
                key={scenario.id}
                className={`${styles.scenarioCard} ${
                  (state.packageOption === "standard" && scenario.id === "tractor") ||
                  (state.packageOption === "service" && scenario.id === "service") ||
                  (state.packageOption === "full" && scenario.id === "full")
                    ? styles.scenarioCardSelected
                    : ""
                }`}
              >
                <div>
                  <h3>{scenario.label}</h3>
                  <p>{scenario.description}</p>
                </div>
                <strong>{rand(scenario.totalCashRequirement)}</strong>
                <span>Five-year cash requirement</span>
              </article>
            ))}
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Year</th>
                  <th>Loan payments</th>
                  <th>Service cash</th>
                  <th>Maintenance cash</th>
                  <th>Annual cash</th>
                  <th>Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {model.cashFlows.flatMap((scenario) =>
                  scenario.years.map((year, index) => (
                    <tr key={`${scenario.id}-${year.year}`}>
                      <td>{index === 0 ? scenario.label.replace(/Option [ABC] — /, "") : ""}</td>
                      <td>{year.year}</td>
                      <td>{rand(year.loanPayments)}</td>
                      <td>{rand(year.serviceCashPayments)}</td>
                      <td>{rand(year.maintenanceCashPayments)}</td>
                      <td>{rand(year.totalAnnualCash)}</td>
                      <td>{rand(year.cumulativeCash)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.splitResult}>
            <Metric
              label="Cost of liquidity"
              value={rand(model.maintenanceFinancePremium)}
              detail="Finance interest added to smooth the selected maintenance packages."
            />
            <Metric
              label="Additional cost per operating hour"
              value={randCents(model.additionalCostPerHour)}
            />
            <Metric
              label="Working-capital effect"
              value="Predictable provision"
              detail="Maintenance cash does not leave the operation as an unplanned lump sum."
            />
          </div>
        </section>

        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={
            activeStepId !== "results" ||
            resultView !== "finance" ||
            !includesMaintenance
          }
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Parts Inflation / Price Lock</h2>
              <p>Future event costs are inflated at their expected timing.</p>
            </div>
          </div>
          <div className={styles.metricGrid}>
            <Metric
              label="Estimated nominal pay-as-you-go spend"
              value={rand(model.reservePayAsYouGo.total)}
            />
            <Metric label="Fixed package" value={rand(model.reserve.packageAmount)} />
            <Metric label="Estimated inflation avoided" value={rand(model.inflationAvoided)} />
            <Metric
              label="Finance interest on package"
              value={rand(model.reserveFinance.totalInterest)}
            />
            <Metric
              label="Net premium / saving"
              value={rand(model.reserveNetBenefit)}
              tone={model.reserveNetBenefit >= 0 ? "green" : "amber"}
              detail="Positive means estimated inflation avoided exceeds finance interest."
            />
          </div>
        </section>

        <section
          className={styles.card}
          hidden={
            activeStepId !== "depreciation" &&
            !(activeStepId === "results" && resultView === "depreciation")
          }
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Future Value</h2>
              <p>Pre-purchase projection using Aim4price age, usage and condition depreciation logic.</p>
            </div>
          </div>
          <div
            className={styles.depreciationInputs}
            hidden={activeStepId === "results"}
          >
            <div className={styles.projectionStrip}>
              <div><span>Starting hours</span><strong>{numberFormat.format(state.startingHours)} h</strong></div>
              <div><span>Hours added</span><strong>{numberFormat.format(state.annualHours * state.ownershipYears)} h</strong></div>
              <div><span>Hours at trade</span><strong>{numberFormat.format(model.futureValue.expectedHours)} h</strong></div>
              <div><span>Expected lifetime</span><strong>{numberFormat.format(model.futureValue.lifetimeHours)} h</strong></div>
            </div>
            <div className={styles.singleFieldRow}>
              <NumericField
                label="Replacement-price inflation"
                value={state.replacementInflationPct}
                onChange={(value) => update("replacementInflationPct", value)}
                suffix="%"
                step={0.1}
              />
            </div>
            <div>
              <div className={styles.choiceHeading}>
                <strong>Expected condition after {numberFormat.format(model.futureValue.expectedHours)} hours</strong>
                <span>Changing condition immediately changes the projected value, trade-in and equity.</span>
              </div>
              <div className={styles.conditionChoices} role="radiogroup" aria-label="Expected condition at trade">
                {model.conditionValues.map((option) => {
                  const selected = option.id === state.condition;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`${styles.conditionChoice} ${selected ? styles.conditionChoiceActive : ""}`}
                      onClick={() => update("condition", option.id)}
                      role="radio"
                      aria-checked={selected}
                    >
                      <span>{selected ? "✓" : `${Math.round(option.factor * 100)}%`}</span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                      <b>{rand(option.value)}</b>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className={styles.calculationTrail}>
            <div><span>New replacement price</span><strong>{rand(state.tractorPrice)}</strong></div>
            <div><span>Projected replacement price</span><strong>{rand(model.futureValue.projectedReplacementPrice)}</strong></div>
            <div><span>Age depreciation</span><strong>{model.futureValue.ageDepreciationPct}%</strong></div>
            <div><span>Usage depreciation</span><strong>{numberFormat.format(model.futureValue.usageDepreciationPct)}%</strong></div>
            <div><span>Combined age + hours depreciation</span><strong>{model.futureValue.averageDepreciationPct}%</strong></div>
            <div><span>Value before condition</span><strong>{rand(model.futureValue.valueBeforeCondition)}</strong></div>
            <div><span>{CONDITION_OPTIONS.find((option) => option.id === state.condition)?.label} condition factor</span><strong>{Math.round(model.futureValue.conditionFactor * 100)}%</strong></div>
            <div className={styles.calculationTotal}><span>Estimated future retail</span><strong>{rand(model.futureValue.estimatedRetailValue)}</strong></div>
          </div>
          <p className={styles.formulaNote}>
            Aim4price first applies the shared age-and-engine-hours depreciation calculation to the projected replacement price, then applies the selected condition factor. This estimated retail value feeds the default trade-in calculation and equity result.
          </p>
        </section>

        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={
            activeStepId !== "depreciation" &&
            !(activeStepId === "results" && resultView === "depreciation")
          }
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Trade-In &amp; Equity</h2>
              <p>Keep projected retail separate from the dealer trade assumption.</p>
            </div>
          </div>
          <div
            className={styles.formGrid}
            hidden={activeStepId === "results"}
          >
            <label className={styles.field}>
              <span>Trade-in mode</span>
              <div className={styles.inputShell}>
                <select
                  value={state.tradeMode}
                  onChange={(event) => update("tradeMode", event.target.value as TradeMode)}
                >
                  <option value="manual">Manual trade-in value</option>
                  <option value="haircut">Percentage haircut from retail</option>
                  <option value="dealer">Direct dealer offer</option>
                </select>
              </div>
            </label>
            {state.tradeMode === "manual" ? (
              <NumericField label="Manual trade-in" value={state.manualTradeValue} onChange={(value) => update("manualTradeValue", value)} prefix="R" />
            ) : null}
            {state.tradeMode === "haircut" ? (
              <NumericField label="Retail haircut" value={state.tradeHaircutPct} onChange={(value) => update("tradeHaircutPct", value)} suffix="%" max={100} step={0.5} />
            ) : null}
            {state.tradeMode === "dealer" ? (
              <NumericField label="Direct dealer offer" value={state.dealerOffer} onChange={(value) => update("dealerOffer", value)} prefix="R" />
            ) : null}
          </div>
          <div className={styles.tradeFlow} hidden={activeStepId === "results"}>
            <div><span>Aim4price future retail</span><strong>{rand(model.futureValue.estimatedRetailValue)}</strong></div>
            <i>→</i>
            <div><span>Trade assumption</span><strong>{rand(model.trade.tradeValue)}</strong></div>
            <i>−</i>
            <div><span>Settlement</span><strong>{rand(model.settlementAtTrade)}</strong></div>
            <i>=</i>
            <div className={model.equity >= 0 ? styles.tradeFlowPositive : styles.tradeFlowNegative}>
              <span>Estimated equity</span><strong>{rand(model.equity)}</strong>
            </div>
          </div>
          {state.tradeMode !== "haircut" && activeStepId !== "results" ? (
            <p className={styles.manualOverrideNote}>
              This trade mode overrides the depreciation-based percentage calculation. Choose “Percentage haircut from retail” to keep trade value directly linked to Aim4price depreciation.
            </p>
          ) : null}
          <div
            className={styles.metricGrid}
            hidden={activeStepId !== "results" || resultView !== "depreciation"}
          >
            <Metric label="Projected retail" value={rand(model.futureValue.estimatedRetailValue)} />
            <Metric label="Assumed trade value" value={rand(model.trade.tradeValue)} />
            <Metric label="Trade discount" value={rand(model.trade.haircutAmount)} detail={`${model.trade.haircutPct}% below projected retail`} />
            <Metric label="Settlement at trade" value={rand(model.settlementAtTrade)} />
            <Metric label="Trade-in equity" value={rand(model.equity)} tone={model.equity >= 0 ? "green" : "red"} detail="Trade value less finance settlement balance." />
          </div>
        </section>

        <details
          className={`${styles.card} ${styles.detailsCard}`}
          hidden={
            activeStepId !== "depreciation" &&
            !(activeStepId === "results" && resultView === "advanced")
          }
          open={activeStepId === "results" ? true : undefined}
        >
          <summary>
            <div>
              <h2>Refinance Scenario</h2>
              <p>Optional: test a proactive restructure while the borrower is still performing.</p>
            </div>
          </summary>
          <div className={styles.detailsBody}>
            <div className={styles.formGrid} hidden={activeStepId === "results"}>
              <NumericField label="Review point" value={state.refinanceMonth} onChange={(value) => update("refinanceMonth", value)} suffix="months" min={1} max={state.termMonths} />
              <NumericField label="New interest rate" value={state.refinanceRatePct} onChange={(value) => update("refinanceRatePct", value)} suffix="%" step={0.1} />
              <NumericField label="New remaining term" value={state.refinanceTermMonths} onChange={(value) => update("refinanceTermMonths", value)} suffix="months" min={1} max={120} />
              <NumericField label="New balloon" value={state.refinanceBalloon} onChange={(value) => update("refinanceBalloon", value)} prefix="R" />
            </div>
            <div className={styles.metricGrid} hidden={activeStepId !== "results" || resultView !== "advanced"}>
              <Metric label="Settlement amount" value={rand(model.refinance.settlementAmount)} />
              <Metric label="Current instalment" value={randCents(model.refinance.currentMonthlyPayment)} />
              <Metric label="New instalment" value={randCents(model.refinance.newMonthlyPayment)} />
              <Metric label="Monthly cash-flow relief" value={randCents(model.refinance.monthlyRelief)} tone={model.refinance.monthlyRelief >= 0 ? "green" : "amber"} />
              <Metric label="New total finance cost" value={rand(model.refinance.newTotalFinanceCost)} />
              <Metric label="Additional restructuring cost" value={rand(model.refinance.additionalCost)} />
            </div>
            <p className={styles.disclaimer}>
              Refinancing is subject to lender approval, affordability, payment history,
              asset valuation, settlement terms and prevailing interest rates. The
              calculator does not imply guaranteed refinance approval.
            </p>
          </div>
        </details>

        <details
          className={`${styles.card} ${styles.detailsCard}`}
          hidden={
            activeStepId !== "depreciation" &&
            !(activeStepId === "results" && resultView === "advanced")
          }
          open={activeStepId === "results" ? true : undefined}
        >
          <summary>
            <div>
              <h2>Next Asset Cycle</h2>
              <p>Optional: allocate future equity to the next service plan, reserve and deposit.</p>
            </div>
          </summary>
          <div className={styles.detailsBody}>
            <div className={styles.formGrid} hidden={activeStepId === "results"}>
              <NumericField label="Next warranty service plan" value={state.nextServicePlan} onChange={(value) => update("nextServicePlan", value)} prefix="R" />
              <NumericField label="Next maintenance reserve" value={state.nextReserve} onChange={(value) => update("nextReserve", value)} prefix="R" />
            </div>
            <div className={styles.equityFlow} hidden={activeStepId !== "results" || resultView !== "advanced"}>
              <div><span>Available equity</span><strong>{rand(Math.max(0, model.equity))}</strong></div>
              <i>−</i>
              <div><span>Service plan</span><strong>{rand(model.nextCycle.serviceAllocation)}</strong></div>
              <i>−</i>
              <div><span>Maintenance reserve</span><strong>{rand(model.nextCycle.reserveAllocation)}</strong></div>
              <i>=</i>
              <div className={styles.equityResult}><span>Replacement deposit</span><strong>{rand(model.nextCycle.remainingDeposit)}</strong></div>
            </div>
            <div className={styles.metricGrid} hidden={activeStepId !== "results" || resultView !== "advanced"}>
              <Metric label="Expected equivalent asset price" value={rand(model.nextCycle.nextTractorPrice)} />
              <Metric label="Next-cycle financed amount" value={rand(model.nextCycle.nextFinancedAmount)} />
              {model.nextCycle.allocationShortfall > 0 ? (
                <Metric label="Maintenance allocation shortfall" value={rand(model.nextCycle.allocationShortfall)} tone="red" />
              ) : null}
            </div>
          </div>
        </details>

        <details
          className={`${styles.card} ${styles.fullWidth} ${styles.detailsCard} ${styles.reportOptionsCard}`}
          hidden={activeStepId !== "depreciation"}
        >
          <summary>
            <div>
              <h2>Optional quote details</h2>
              <p>Add a client reference, notes or internal dealer economics only when needed.</p>
            </div>
          </summary>
          <div className={styles.detailsBody}>
            <div className={styles.formGrid}>
              <TextField label="Client / Farm name" value={state.clientName} onChange={(value) => update("clientName", value)} placeholder="Optional" />
              <TextField label="Asset description" value={state.tractorDescription} onChange={(value) => update("tractorDescription", value)} placeholder="e.g. tractor, harvester or industrial machine" />
              <TextField label="Dealer" value={state.dealerName} onChange={(value) => update("dealerName", value)} placeholder="Optional" />
              <TextField label="Quote reference" value={state.quoteReference} onChange={(value) => update("quoteReference", value)} placeholder="Optional" />
              <label className={`${styles.field} ${styles.notesField}`}>
                <span>Notes</span>
                <textarea value={state.notes} onChange={(event) => update("notes", event.target.value)} rows={4} placeholder="Optional deal notes" />
              </label>
            </div>
            <Toggle
              label="Include dealer economics"
              checked={includeDealerEconomics}
              onChange={setIncludeDealerEconomics}
              help="Adds the dealer trade spread, service and parts margin, risk reserve and commercial buffer to the advanced results."
            />
          </div>
        </details>

        <details
          className={`${styles.card} ${styles.fullWidth} ${styles.detailsCard}`}
          hidden={
            !includeDealerEconomics ||
            (activeStepId !== "depreciation" &&
              !(activeStepId === "results" && resultView === "advanced"))
          }
          open={
            (activeStepId === "results" && includeDealerEconomics) ||
            undefined
          }
        >
          <summary>
            <div>
              <h2>Dealer Economics</h2>
              <p>Optional admin-only commercial contribution view.</p>
            </div>
          </summary>
          <div className={styles.detailsBody}>
            <div
              className={styles.formGrid}
              hidden={activeStepId === "results"}
            >
              <NumericField label="Trade-in allowance" value={state.dealerTradeAllowance} onChange={(value) => update("dealerTradeAllowance", value)} prefix="R" />
              <NumericField label="Expected resale price" value={state.dealerExpectedResale} onChange={(value) => update("dealerExpectedResale", value)} prefix="R" />
              <NumericField label="Estimated recon cost" value={state.dealerReconCost} onChange={(value) => update("dealerReconCost", value)} prefix="R" />
              <NumericField label="Estimated holding cost" value={state.dealerHoldingCost} onChange={(value) => update("dealerHoldingCost", value)} prefix="R" />
              <NumericField label="Service / parts gross margin" value={state.dealerGrossMarginPct} onChange={(value) => update("dealerGrossMarginPct", value)} suffix="%" max={100} step={0.5} help="Gross margin, not markup." />
              <NumericField label="New-asset gross profit" value={state.dealerNewTractorProfit} onChange={(value) => update("dealerNewTractorProfit", value)} prefix="R" />
              <NumericField label="Commercial risk reserve" value={state.dealerRiskReserve} onChange={(value) => update("dealerRiskReserve", value)} prefix="R" />
            </div>
            <div
              className={styles.metricGrid}
              hidden={activeStepId !== "results" || resultView !== "advanced"}
            >
              <Metric label="Trade contribution" value={rand(model.dealer.tradeContribution)} />
              <Metric label="Service / parts contribution" value={rand(model.dealer.servicePartsContribution)} detail="Revenue multiplied by gross margin; not total package revenue." />
              <Metric label="New asset contribution" value={rand(model.dealer.newTractorContribution)} />
              <Metric label="Total estimated gross contribution" value={rand(model.dealer.totalGrossContribution)} />
              <Metric label="Risk reserve" value={rand(model.dealer.riskReserve)} />
              <Metric label="Remaining commercial buffer" value={rand(model.dealer.commercialBuffer)} tone={model.dealer.commercialBuffer >= 0 ? "green" : "red"} />
            </div>
          </div>
        </details>

        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={activeStepId !== "results" || resultView !== "depreciation"}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Five-Year Timeline</h2>
              <p>Depreciation, inflation, amortisation, maintenance and equity in one view.</p>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Hours</th>
                  <th>Replacement price</th>
                  <th>Estimated asset value</th>
                  <th>Trade value</th>
                  <th>Loan balance</th>
                  <th>Equity</th>
                  <th>Planned maintenance</th>
                </tr>
              </thead>
              <tbody>
                {model.timeline.map((row) => (
                  <tr key={row.year}>
                    <td>{row.year}</td>
                    <td>{numberFormat.format(row.hours)} h</td>
                    <td>{rand(row.replacementPrice)}</td>
                    <td>{rand(row.estimatedRetailValue)}</td>
                    <td>{rand(row.tradeValue)}</td>
                    <td>{rand(row.loanBalance)}</td>
                    <td className={row.equity < 0 ? styles.negative : styles.positive}>{rand(row.equity)}</td>
                    <td>{rand(row.plannedMaintenance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      <nav className={styles.flowActions} aria-label="Calculator step actions">
        {activeStep > 0 ? (
          <button
            type="button"
            className={styles.secondaryFlowButton}
            onClick={() => moveToStep(activeStep - 1)}
          >
            ← Back
          </button>
        ) : (
          <span />
        )}

        <div className={styles.flowActionStatus}>
          {activeStep < resultsStep && !stepIsValid ? (
            <span>Complete the required fields before continuing.</span>
          ) : activeStep < resultsStep ? (
            <span>{selectedPackage.label} · values update as you continue.</span>
          ) : (
            <button
              type="button"
              className={styles.textFlowButton}
              onClick={startNewCalculation}
            >
              Start new calculation
            </button>
          )}
        </div>

        {activeStep < resultsStep ? (
          <button
            type="button"
            className={styles.primaryFlowButton}
            onClick={() => moveToStep(activeStep + 1)}
            disabled={!stepIsValid}
          >
            {activeStep === resultsStep - 1 ? "View results" : "Continue"} →
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryFlowButton}
            onClick={() => window.print()}
          >
            Print results
          </button>
        )}
      </nav>

      <footer
        className={styles.footerDisclaimer}
        hidden={activeStepId !== "results"}
      >
        Aim4price calculations are indicative scenario estimates and do not
        constitute a lending decision, guaranteed future value, guaranteed
        trade-in value, tax advice or an offer to purchase. Actual finance,
        maintenance, resale and refinance outcomes depend on the relevant
        provider and future asset condition.
      </footer>
    </div>
  );
}
