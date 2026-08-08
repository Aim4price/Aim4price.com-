"use client";

import { useMemo, useState } from "react";
import type { ConditionKey, TractorType } from "../../../lib/tractor-data";
import {
  buildCashFlowScenarios,
  buildLifecycleTimeline,
  calculateDealerEconomics,
  calculateEquity,
  calculateFutureTractorValue,
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
  tractorType: TractorType;
  powerKw: number;
  startingHours: number;
  annualHours: number;
  ownershipYears: number;
  condition: ConditionKey;
  replacementInflationPct: number;
  deposit: number;
  annualRatePct: number;
  termMonths: number;
  balloon: number;
  financeFees: number;
  serviceIntervalHours: number;
  serviceCost: number;
  servicePlanYears: number;
  negotiatedServicePlan: number;
  financeServicePlan: boolean;
  reserveMode: "calculated" | "fixed";
  reserveCostPerEvent: number;
  reserveEventsPerYear: number;
  postWarrantyYears: number;
  fixedReserveAmount: number;
  financeReserve: boolean;
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

const CURRENT_YEAR = new Date().getFullYear();

const INITIAL_STATE: CalculatorState = {
  clientName: "",
  tractorDescription: "",
  dealerName: "",
  quoteReference: "",
  notes: "",
  tractorPrice: 500_000,
  purchaseYear: CURRENT_YEAR,
  tractorType: "field",
  powerKw: 90,
  startingHours: 0,
  annualHours: 1_000,
  ownershipYears: 5,
  condition: "good",
  replacementInflationPct: 3,
  deposit: 0,
  annualRatePct: 10.5,
  termMonths: 60,
  balloon: 0,
  financeFees: 0,
  serviceIntervalHours: 250,
  serviceCost: 8_000,
  servicePlanYears: 2,
  negotiatedServicePlan: 64_000,
  financeServicePlan: true,
  reserveMode: "fixed",
  reserveCostPerEvent: 4_000,
  reserveEventsPerYear: 4,
  postWarrantyYears: 3,
  fixedReserveAmount: 50_000,
  financeReserve: true,
  partsInflationPct: 3,
  tradeMode: "manual",
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
    label: "Tractor",
    title: "Tell us about the tractor",
    description:
      "Start with the new tractor, how it will be used and how long it will be kept.",
  },
  {
    label: "Finance",
    title: "Set the finance structure",
    description:
      "Enter the deposit, interest rate, term and any balloon or initiation fees.",
  },
  {
    label: "Maintenance",
    title: "Build the maintenance package",
    description:
      "Structure warranty servicing and the post-warranty uptime reserve.",
  },
  {
    label: "Trade-in",
    title: "Set future value and trade assumptions",
    description:
      "Choose replacement-price inflation, expected condition and a conservative trade method.",
  },
  {
    label: "Next cycle",
    title: "Plan for refinance and replacement",
    description:
      "Test a refinance review point and decide how future equity should fund the next tractor cycle.",
  },
  {
    label: "Report",
    title: "Add report and dealer details",
    description:
      "Add optional client references and include dealer economics only when they are useful.",
  },
  {
    label: "Results",
    title: "Lifecycle finance results",
    description:
      "Review the complete structure, compare cash flow and print the deal summary.",
  },
] as const;

const RESULTS_STEP = FLOW_STEPS.length - 1;

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

  function update<K extends keyof CalculatorState>(
    key: K,
    value: CalculatorState[K],
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function moveToStep(step: number) {
    const nextStep = Math.min(RESULTS_STEP, Math.max(0, step));
    setActiveStep(nextStep);
    setFurthestStep((current) => Math.max(current, nextStep));
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
    setFurthestStep(0);
    moveToStep(0);
  }

  const stepIsValid =
    activeStep === 0
      ? state.tractorPrice > 0 &&
        state.purchaseYear >= 2000 &&
        state.powerKw > 0 &&
        state.ownershipYears > 0
      : activeStep === 1
        ? state.termMonths > 0 &&
          state.annualRatePct >= 0 &&
          state.deposit >= 0 &&
          state.balloon >= 0
        : activeStep === 2
          ? state.serviceIntervalHours > 0 &&
            state.serviceCost >= 0 &&
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
      (state.financeServicePlan ? servicePlan.packageAmount : 0) +
      (state.financeReserve ? reserve.packageAmount : 0) +
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
        (state.financeServicePlan ? serviceFinance.monthlyPayment : 0) -
        (state.financeReserve ? reserveFinance.monthlyPayment : 0) -
        feeFinance.monthlyPayment,
    );
    const targetYear = state.purchaseYear + state.ownershipYears;
    const futureValue = calculateFutureTractorValue({
      newPrice: state.tractorPrice,
      purchaseYear: state.purchaseYear,
      targetYear,
      startingHours: state.startingHours,
      expectedAnnualHours: state.annualHours,
      tractorType: state.tractorType,
      powerKw: state.powerKw,
      condition: state.condition,
      inflationRatePct: state.replacementInflationPct,
    });
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
    const tractorOnlyCashFlow = cashFlows.find(
      (scenario) => scenario.id === "tractor",
    );
    const plannedMaintenanceByYear =
      tractorOnlyCashFlow?.years.map(
        (year) => year.serviceCashPayments + year.maintenanceCashPayments,
      ) ?? [];
    const timeline = buildLifecycleTimeline({
      futureValue: {
        newPrice: state.tractorPrice,
        purchaseYear: state.purchaseYear,
        startingHours: state.startingHours,
        expectedAnnualHours: state.annualHours,
        tractorType: state.tractorType,
        powerKw: state.powerKw,
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
      (state.financeServicePlan ? 0 : servicePayAsYouGo.total) +
      (state.financeReserve ? 0 : reservePayAsYouGo.total);
    const netOwnershipCost =
      packageLoan.totalRepayment + cashMaintenance - trade.tradeValue;
    const maintenanceFinancePremium =
      (state.financeServicePlan ? serviceFinance.totalInterest : 0) +
      (state.financeReserve ? reserveFinance.totalInterest : 0);

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
  }, [state]);

  return (
    <div
      id="lifecycle-calculator-flow"
      className={styles.calculator}
      data-active-step={activeStep}
    >
      <section className={styles.flowHeader} aria-label="Calculator progress">
        <div className={styles.flowProgressCopy}>
          <span>
            {activeStep === RESULTS_STEP
              ? "Calculation complete"
              : `Step ${activeStep + 1} of ${RESULTS_STEP}`}
          </span>
          <strong>{FLOW_STEPS[activeStep].label}</strong>
        </div>
        <div className={styles.flowProgressTrack} aria-hidden="true">
          <i
            style={{
              width: `${Math.max(
                4,
                (activeStep / RESULTS_STEP) * 100,
              )}%`,
            }}
          />
        </div>
        <ol className={styles.flowSteps}>
          {FLOW_STEPS.map((step, index) => {
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
        hidden={activeStep === RESULTS_STEP}
      >
        <p className={styles.eyebrow}>Guided lifecycle calculation</p>
        <h2>{FLOW_STEPS[activeStep].title}</h2>
        <p>{FLOW_STEPS[activeStep].description}</p>
      </section>

      <aside
        className={styles.summaryPanel}
        aria-label="Deal summary"
        hidden={activeStep !== RESULTS_STEP}
      >
        <div className={styles.summaryHeading}>
          <div>
            <p className={styles.eyebrow}>Lifecycle results</p>
            <h2>{state.tractorDescription || "New tractor scenario"}</h2>
            <span>
              {state.clientName || "Pre-purchase scenario"} · {state.ownershipYears}
              -year ownership plan
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
          <Metric label="New tractor" value={rand(state.tractorPrice)} />
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

      <div className={styles.contentGrid}>
        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={activeStep !== 0}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Tractor</h2>
              <p>Start with the negotiated new price before depreciation.</p>
            </div>
          </div>
          <div className={styles.formGrid}>
            <NumericField
              label="New tractor price"
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
            <label className={styles.field}>
              <span>Tractor type</span>
              <div className={styles.inputShell}>
                <select
                  value={state.tractorType}
                  onChange={(event) =>
                    update("tractorType", event.target.value as TractorType)
                  }
                >
                  <option value="field">Field</option>
                  <option value="orchard">Orchard</option>
                </select>
              </div>
            </label>
            <NumericField
              label="Power"
              value={state.powerKw}
              onChange={(value) => update("powerKw", value)}
              suffix="kW"
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
              label="Ownership horizon"
              value={state.ownershipYears}
              onChange={(value) => update("ownershipYears", value)}
              suffix="years"
              min={1}
              max={15}
            />
            <label className={styles.field}>
              <span>Expected condition at end</span>
              <div className={styles.inputShell}>
                <select
                  value={state.condition}
                  onChange={(event) =>
                    update("condition", event.target.value as ConditionKey)
                  }
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="used">Used</option>
                  <option value="serious">Serious attention</option>
                </select>
              </div>
            </label>
          </div>
          <div className={styles.inlineResult}>
            <span>Expected future hours</span>
            <strong>{numberFormat.format(model.futureValue.expectedHours)} h</strong>
          </div>
        </section>

        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={activeStep !== 1}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Finance</h2>
              <p>Standard monthly amortising finance with an optional balloon.</p>
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
              max={120}
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
          <div className={styles.stepNote}>
            <strong>Results are shown at the end.</strong>
            <span>
              The calculator will combine this finance structure with the
              maintenance choices in the next step.
            </span>
          </div>
        </section>

        <section className={styles.card} hidden={activeStep !== 2}>
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
          </div>
          <Toggle
            label="Finance this service plan"
            checked={state.financeServicePlan}
            onChange={(value) => update("financeServicePlan", value)}
            help="Adds the negotiated package to the selected finance structure."
          />
        </section>

        <section className={styles.card} hidden={activeStep !== 2}>
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
          </div>
          <Toggle
            label="Finance uptime reserve"
            checked={state.financeReserve}
            onChange={(value) => update("financeReserve", value)}
            help="Adds the selected reserve to the finance package."
          />
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
          hidden={activeStep !== RESULTS_STEP}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Complete Package</h2>
              <p>See exactly what each layer adds to the monthly instalment.</p>
            </div>
          </div>
          <div className={styles.packageGrid}>
            <article>
              <span>Base tractor only</span>
              <strong>{rand(state.tractorPrice)}</strong>
              <small>{randCents(model.tractorOnlyLoan.monthlyPayment)} / month</small>
            </article>
            <article>
              <span>Tractor + warranty servicing</span>
              <strong>{rand(state.tractorPrice + model.servicePlan.packageAmount)}</strong>
              <small>{randCents(model.tractorServiceLoan.monthlyPayment)} / month</small>
            </article>
            <article className={styles.packagePrimary}>
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
              <span>Tractor</span>
              <strong>{randCents(model.tractorContribution)}</strong>
            </div>
            <div>
              <span>Service plan</span>
              <strong>
                {state.financeServicePlan
                  ? randCents(model.serviceFinance.monthlyPayment)
                  : "Not financed"}
              </strong>
            </div>
            <div>
              <span>Uptime reserve</span>
              <strong>
                {state.financeReserve
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
          hidden={activeStep !== RESULTS_STEP}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Cash-Flow Comparison</h2>
              <p>Cheapest total cost and best cash-flow predictability are not the same decision.</p>
            </div>
          </div>
          <div className={styles.scenarioGrid}>
            {model.cashFlows.map((scenario) => (
              <article key={scenario.id} className={styles.scenarioCard}>
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
          className={styles.card}
          hidden={activeStep !== RESULTS_STEP}
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
          hidden={activeStep !== 3 && activeStep !== RESULTS_STEP}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Future Value</h2>
              <p>Pre-purchase projection using Aim4price tractor depreciation logic.</p>
            </div>
          </div>
          <div
            className={styles.formGrid}
            hidden={activeStep === RESULTS_STEP}
          >
            <NumericField
              label="Replacement-price inflation"
              value={state.replacementInflationPct}
              onChange={(value) => update("replacementInflationPct", value)}
              suffix="%"
              step={0.1}
            />
          </div>
          <div
            className={styles.calculationTrail}
            hidden={activeStep !== RESULTS_STEP}
          >
            <div><span>New replacement price</span><strong>{rand(state.tractorPrice)}</strong></div>
            <div><span>Projected replacement price</span><strong>{rand(model.futureValue.projectedReplacementPrice)}</strong></div>
            <div><span>Age depreciation</span><strong>{model.futureValue.ageDepreciationPct}%</strong></div>
            <div><span>Usage depreciation</span><strong>{numberFormat.format(model.futureValue.usageDepreciationPct)}%</strong></div>
            <div><span>Condition adjustment</span><strong>{Math.round(model.futureValue.conditionFactor * 100)}%</strong></div>
            <div className={styles.calculationTotal}><span>Estimated future retail</span><strong>{rand(model.futureValue.estimatedRetailValue)}</strong></div>
          </div>
        </section>

        <section
          className={styles.card}
          hidden={activeStep !== 3 && activeStep !== RESULTS_STEP}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Trade-In &amp; Equity</h2>
              <p>Keep projected retail separate from the dealer trade assumption.</p>
            </div>
          </div>
          <div
            className={styles.formGrid}
            hidden={activeStep === RESULTS_STEP}
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
          <div
            className={styles.metricGrid}
            hidden={activeStep !== RESULTS_STEP}
          >
            <Metric label="Projected retail" value={rand(model.futureValue.estimatedRetailValue)} />
            <Metric label="Assumed trade value" value={rand(model.trade.tradeValue)} />
            <Metric label="Trade discount" value={rand(model.trade.haircutAmount)} detail={`${model.trade.haircutPct}% below projected retail`} />
            <Metric label="Settlement at trade" value={rand(model.settlementAtTrade)} />
            <Metric label="Trade-in equity" value={rand(model.equity)} tone={model.equity >= 0 ? "green" : "red"} detail="Trade value less finance settlement balance." />
          </div>
        </section>

        <section
          className={styles.card}
          hidden={activeStep !== 4 && activeStep !== RESULTS_STEP}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Refinance Scenario</h2>
              <p>Model a proactive restructure while the borrower is still performing.</p>
            </div>
          </div>
          <div
            className={styles.formGrid}
            hidden={activeStep === RESULTS_STEP}
          >
            <NumericField label="Review point" value={state.refinanceMonth} onChange={(value) => update("refinanceMonth", value)} suffix="months" min={1} max={state.termMonths} />
            <NumericField label="New interest rate" value={state.refinanceRatePct} onChange={(value) => update("refinanceRatePct", value)} suffix="%" step={0.1} />
            <NumericField label="New remaining term" value={state.refinanceTermMonths} onChange={(value) => update("refinanceTermMonths", value)} suffix="months" min={1} max={120} />
            <NumericField label="New balloon" value={state.refinanceBalloon} onChange={(value) => update("refinanceBalloon", value)} prefix="R" />
          </div>
          <div
            className={styles.metricGrid}
            hidden={activeStep !== RESULTS_STEP}
          >
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
        </section>

        <section
          className={styles.card}
          hidden={activeStep !== 4 && activeStep !== RESULTS_STEP}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Next Tractor Cycle</h2>
              <p>Recycle trade-in equity into maintenance protection and the next deposit.</p>
            </div>
          </div>
          <div
            className={styles.formGrid}
            hidden={activeStep === RESULTS_STEP}
          >
            <NumericField label="Next warranty service plan" value={state.nextServicePlan} onChange={(value) => update("nextServicePlan", value)} prefix="R" />
            <NumericField label="Next uptime reserve" value={state.nextReserve} onChange={(value) => update("nextReserve", value)} prefix="R" />
          </div>
          <div
            className={styles.equityFlow}
            hidden={activeStep !== RESULTS_STEP}
          >
            <div><span>Available equity</span><strong>{rand(Math.max(0, model.equity))}</strong></div>
            <i>−</i>
            <div><span>Service plan</span><strong>{rand(model.nextCycle.serviceAllocation)}</strong></div>
            <i>−</i>
            <div><span>Uptime reserve</span><strong>{rand(model.nextCycle.reserveAllocation)}</strong></div>
            <i>=</i>
            <div className={styles.equityResult}><span>Replacement deposit</span><strong>{rand(model.nextCycle.remainingDeposit)}</strong></div>
          </div>
          <div
            className={styles.metricGrid}
            hidden={activeStep !== RESULTS_STEP}
          >
            <Metric label="Expected equivalent tractor price" value={rand(model.nextCycle.nextTractorPrice)} />
            <Metric label="Next-cycle financed amount" value={rand(model.nextCycle.nextFinancedAmount)} />
            {model.nextCycle.allocationShortfall > 0 ? (
              <Metric label="Maintenance allocation shortfall" value={rand(model.nextCycle.allocationShortfall)} tone="red" />
            ) : null}
          </div>
        </section>

        <section
          className={`${styles.card} ${styles.fullWidth} ${styles.reportOptionsCard}`}
          hidden={activeStep !== 5}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Report Options</h2>
              <p>Keep internal dealer economics out unless this discussion needs them.</p>
            </div>
          </div>
          <Toggle
            label="Include dealer economics"
            checked={includeDealerEconomics}
            onChange={setIncludeDealerEconomics}
            help="Adds the dealer trade spread, service and parts margin, risk reserve and commercial buffer to the final results."
          />
        </section>

        <details
          className={`${styles.card} ${styles.fullWidth} ${styles.detailsCard}`}
          hidden={
            !includeDealerEconomics ||
            (activeStep !== 5 && activeStep !== RESULTS_STEP)
          }
          open={
            activeStep === 5 ||
            (activeStep === RESULTS_STEP && includeDealerEconomics) ||
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
              hidden={activeStep === RESULTS_STEP}
            >
              <NumericField label="Trade-in allowance" value={state.dealerTradeAllowance} onChange={(value) => update("dealerTradeAllowance", value)} prefix="R" />
              <NumericField label="Expected resale price" value={state.dealerExpectedResale} onChange={(value) => update("dealerExpectedResale", value)} prefix="R" />
              <NumericField label="Estimated recon cost" value={state.dealerReconCost} onChange={(value) => update("dealerReconCost", value)} prefix="R" />
              <NumericField label="Estimated holding cost" value={state.dealerHoldingCost} onChange={(value) => update("dealerHoldingCost", value)} prefix="R" />
              <NumericField label="Service / parts gross margin" value={state.dealerGrossMarginPct} onChange={(value) => update("dealerGrossMarginPct", value)} suffix="%" max={100} step={0.5} help="Gross margin, not markup." />
              <NumericField label="New-tractor gross profit" value={state.dealerNewTractorProfit} onChange={(value) => update("dealerNewTractorProfit", value)} prefix="R" />
              <NumericField label="Commercial risk reserve" value={state.dealerRiskReserve} onChange={(value) => update("dealerRiskReserve", value)} prefix="R" />
            </div>
            <div
              className={styles.metricGrid}
              hidden={activeStep !== RESULTS_STEP}
            >
              <Metric label="Trade contribution" value={rand(model.dealer.tradeContribution)} />
              <Metric label="Service / parts contribution" value={rand(model.dealer.servicePartsContribution)} detail="Revenue multiplied by gross margin; not total package revenue." />
              <Metric label="New tractor contribution" value={rand(model.dealer.newTractorContribution)} />
              <Metric label="Total estimated gross contribution" value={rand(model.dealer.totalGrossContribution)} />
              <Metric label="Risk reserve" value={rand(model.dealer.riskReserve)} />
              <Metric label="Remaining commercial buffer" value={rand(model.dealer.commercialBuffer)} tone={model.dealer.commercialBuffer >= 0 ? "green" : "red"} />
            </div>
          </div>
        </details>

        <section
          className={`${styles.card} ${styles.fullWidth}`}
          hidden={activeStep !== RESULTS_STEP}
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

        <section
          className={`${styles.card} ${styles.fullWidth} ${styles.printDetails}`}
          hidden={activeStep !== 5}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>Deal Summary Details</h2>
              <p>Optional references included in the print view only.</p>
            </div>
          </div>
          <div className={styles.formGrid}>
            <TextField label="Client / Farm name" value={state.clientName} onChange={(value) => update("clientName", value)} placeholder="Optional" />
            <TextField label="Tractor description" value={state.tractorDescription} onChange={(value) => update("tractorDescription", value)} placeholder="e.g. 90 kW field tractor" />
            <TextField label="Dealer" value={state.dealerName} onChange={(value) => update("dealerName", value)} placeholder="Optional" />
            <TextField label="Quote reference" value={state.quoteReference} onChange={(value) => update("quoteReference", value)} placeholder="Optional" />
            <label className={`${styles.field} ${styles.notesField}`}>
              <span>Notes</span>
              <textarea value={state.notes} onChange={(event) => update("notes", event.target.value)} rows={4} placeholder="Optional deal notes" />
            </label>
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
          {activeStep < RESULTS_STEP && !stepIsValid ? (
            <span>Complete the required fields before continuing.</span>
          ) : activeStep < RESULTS_STEP ? (
            <span>Your values are saved as you move through the flow.</span>
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

        {activeStep < RESULTS_STEP ? (
          <button
            type="button"
            className={styles.primaryFlowButton}
            onClick={() => moveToStep(activeStep + 1)}
            disabled={!stepIsValid}
          >
            {activeStep === RESULTS_STEP - 1 ? "View results" : "Continue"} →
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
        hidden={activeStep !== RESULTS_STEP}
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
