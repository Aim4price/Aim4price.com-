"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ConditionKey } from "../../../lib/tractor-data";
import {
  DEFAULT_LIFECYCLE_MODEL_INPUT,
  buildLifecycleWorkspaceModel,
  calculateDealerEconomics,
  calculateNextCycle,
  calculateRefinanceScenario,
  type LifecycleModelInput,
  type LifecycleScenarioId,
  type LifecycleScenarioSummary,
  type LifecycleServiceBasis,
  type LifecycleUsageBasis,
  type VatTreatment,
} from "../../../lib/admin-lifecycle-calculator";
import styles from "./page.module.css";

type WorkspaceState = {
  modelInput: LifecycleModelInput;
  clientName: string;
  assetDescription: string;
  preferredScenario: LifecycleScenarioId;
  maintenanceYearsAutomatic: boolean;
  nextServiceAllocation: number;
  nextMaintenanceAllocation: number;
  refinanceMonth: number;
  refinanceRatePct: number;
  refinanceTermMonths: number;
  refinanceBalloon: number;
  stressInterestRatePct: number;
  stressAssetInflationPct: number;
  stressMaintenanceInflationPct: number;
  stressTradeHaircutPct: number;
  stressOwnershipYears: number;
  stressAnnualUsage: number;
  stressCondition: ConditionKey;
  includeDealerEconomics: boolean;
  dealerTradeAllowance: number;
  dealerExpectedResale: number;
  dealerReconCost: number;
  dealerHoldingCost: number;
  dealerGrossMarginPct: number;
  dealerNewAssetProfit: number;
  dealerRiskReserve: number;
};

const CONDITION_OPTIONS: Array<{
  id: ConditionKey;
  label: string;
  description: string;
}> = [
  { id: "excellent", label: "Excellent", description: "Exceptional care" },
  { id: "good", label: "Good", description: "Light wear, well kept" },
  { id: "fair", label: "Fair", description: "Visible wear, usable" },
  { id: "used", label: "Used", description: "Heavy wear, repairs likely" },
  { id: "serious", label: "Serious attention", description: "Major work needed" },
];

const INITIAL_STATE: WorkspaceState = {
  modelInput: { ...DEFAULT_LIFECYCLE_MODEL_INPUT },
  clientName: "",
  assetDescription: "",
  preferredScenario: "standard",
  maintenanceYearsAutomatic: true,
  nextServiceAllocation: 64_000,
  nextMaintenanceAllocation: 50_000,
  refinanceMonth: 36,
  refinanceRatePct: 10.5,
  refinanceTermMonths: 48,
  refinanceBalloon: 0,
  stressInterestRatePct: 13.5,
  stressAssetInflationPct: 1,
  stressMaintenanceInflationPct: 6,
  stressTradeHaircutPct: 22,
  stressOwnershipYears: 5,
  stressAnnualUsage: 1_200,
  stressCondition: "used",
  includeDealerEconomics: false,
  dealerTradeAllowance: 260_000,
  dealerExpectedResale: 290_000,
  dealerReconCost: 0,
  dealerHoldingCost: 0,
  dealerGrossMarginPct: 20,
  dealerNewAssetProfit: 0,
  dealerRiskReserve: 0,
};

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
  const fractionDigits = String(step).includes(".")
    ? String(step).split(".")[1]?.length ?? 0
    : 0;
  const formatValue = (nextValue: number) =>
    new Intl.NumberFormat("en-ZA", {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.max(fractionDigits, 2),
    }).format(Number.isFinite(nextValue) ? nextValue : 0);
  const [draft, setDraft] = useState(() => formatValue(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatValue(value));
    }
  }, [value, isFocused]);

  function parseDraft(nextDraft: string): number | null {
    const normalized = nextDraft
      .replace(/[\s\u00a0]/g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return normalized === "" || normalized === "-" || !Number.isFinite(parsed)
      ? null
      : parsed;
  }

  function commitDraft() {
    const parsed = parseDraft(draft);
    const boundedValue = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, parsed ?? value));
    onChange(boundedValue);
    setDraft(formatValue(boundedValue));
    setIsFocused(false);
  }

  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.inputShell}>
        {prefix ? <b>{prefix}</b> : null}
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={() => {
            setIsFocused(true);
            setDraft(String(value));
          }}
          onChange={(event) => {
            const nextDraft = event.target.value;
            setDraft(nextDraft);
            const parsed = parseDraft(nextDraft);
            if (parsed !== null) {
              onChange(parsed);
            }
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
        />
        {suffix ? <b>{suffix}</b> : null}
      </div>
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

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  help?: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.inputShell}>
        <select value={value} onChange={(event) => onChange(event.target.value as T)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
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
      <strong>{label}</strong>
    </label>
  );
}

function VatControl({
  value,
  onChange,
}: {
  value: VatTreatment;
  onChange: (value: VatTreatment) => void;
}) {
  return (
    <div className={styles.vatControl}>
      <div>
        <strong>Prices entered</strong>
      </div>
      <div className={styles.segmentedButtons} role="group" aria-label="VAT treatment">
        <button
          type="button"
          className={value === "included" ? styles.segmentedActive : ""}
          aria-pressed={value === "included"}
          onClick={() => onChange("included")}
        >
          VAT Included
        </button>
        <button
          type="button"
          className={value === "excluded" ? styles.segmentedActive : ""}
          aria-pressed={value === "excluded"}
          onClick={() => onChange("excluded")}
        >
          VAT Excluded
        </button>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
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
    </div>
  );
}

function ComparisonCell({
  scenario,
  preferredScenario,
  children,
  strong = false,
}: {
  scenario: LifecycleScenarioSummary;
  preferredScenario: LifecycleScenarioId;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={`${scenario.id === preferredScenario ? styles.preferredColumn : ""} ${
        strong ? styles.comparisonStrong : ""
      }`}
    >
      {children}
    </td>
  );
}

function conditionLabel(condition: ConditionKey): string {
  return CONDITION_OPTIONS.find((option) => option.id === condition)?.label ?? condition;
}

export default function LifecycleCalculatorClient() {
  const [state, setState] = useState<WorkspaceState>(INITIAL_STATE);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const model = useMemo(
    () => buildLifecycleWorkspaceModel(state.modelInput),
    [state.modelInput],
  );
  const preferred =
    model.scenarios.find((scenario) => scenario.id === state.preferredScenario) ??
    model.scenarios[0];
  const standard = model.scenarios[0];
  const serviceScenario = model.scenarios[1];
  const fullScenario = model.scenarios[2];
  const nextCycle = useMemo(
    () =>
      calculateNextCycle({
        equity: preferred.equityAtDisposal,
        nextServicePlan: state.nextServiceAllocation,
        nextUptimeReserve: state.nextMaintenanceAllocation,
        currentNewPrice: model.future.startingPrice.grossAmount,
        inflationRatePct: model.input.assetInflationPct,
        years: model.input.ownershipYears,
      }),
    [model, preferred.equityAtDisposal, state.nextMaintenanceAllocation, state.nextServiceAllocation],
  );
  const refinance = useMemo(
    () =>
      calculateRefinanceScenario({
        originalLoan: preferred.loanTerms,
        refinanceMonth: state.refinanceMonth,
        newAnnualRatePct: state.refinanceRatePct,
        newTermMonths: state.refinanceTermMonths,
        newBalloon: state.refinanceBalloon,
      }),
    [preferred.loanTerms, state.refinanceBalloon, state.refinanceMonth, state.refinanceRatePct, state.refinanceTermMonths],
  );
  const sensitivity = useMemo(() => {
    const input = model.input;
    const midpoint = (base: number, stress: number) => (base + stress) / 2;
    const conservativeCondition: ConditionKey =
      input.condition === "excellent"
        ? "good"
        : input.condition === "good"
          ? "fair"
          : input.condition;
    const conservative = buildLifecycleWorkspaceModel({
      ...input,
      annualRatePct: midpoint(input.annualRatePct, state.stressInterestRatePct),
      assetInflationPct: midpoint(input.assetInflationPct, state.stressAssetInflationPct),
      maintenanceInflationPct: midpoint(input.maintenanceInflationPct, state.stressMaintenanceInflationPct),
      tradeHaircutPct: midpoint(input.tradeHaircutPct, state.stressTradeHaircutPct),
      ownershipYears: Math.round(midpoint(input.ownershipYears, state.stressOwnershipYears)),
      annualUsage: midpoint(input.annualUsage, state.stressAnnualUsage),
      condition: conservativeCondition,
    });
    const stress = buildLifecycleWorkspaceModel({
      ...input,
      annualRatePct: state.stressInterestRatePct,
      assetInflationPct: state.stressAssetInflationPct,
      maintenanceInflationPct: state.stressMaintenanceInflationPct,
      tradeHaircutPct: state.stressTradeHaircutPct,
      ownershipYears: state.stressOwnershipYears,
      annualUsage: state.stressAnnualUsage,
      condition: state.stressCondition,
    });
    return [
      { label: "Base", model },
      { label: "Conservative", model: conservative },
      { label: "Stress", model: stress },
    ];
  }, [model, state.stressAnnualUsage, state.stressAssetInflationPct, state.stressCondition, state.stressInterestRatePct, state.stressMaintenanceInflationPct, state.stressOwnershipYears, state.stressTradeHaircutPct]);
  const dealerScenarios = useMemo(
    () =>
      model.scenarios.map((scenario) => ({
        ...scenario,
        economics: calculateDealerEconomics({
          tradeAllowance: state.dealerTradeAllowance,
          expectedResalePrice: state.dealerExpectedResale,
          reconCost: state.dealerReconCost,
          holdingCost: state.dealerHoldingCost,
          servicePlanRevenue: scenario.serviceFinanced,
          uptimeReserveRevenue: scenario.maintenanceFinanced,
          grossMarginPct: state.dealerGrossMarginPct,
          newTractorGrossProfit: state.dealerNewAssetProfit,
          riskReserve: state.dealerRiskReserve,
        }),
      })),
    [model.scenarios, state.dealerExpectedResale, state.dealerGrossMarginPct, state.dealerHoldingCost, state.dealerNewAssetProfit, state.dealerReconCost, state.dealerRiskReserve, state.dealerTradeAllowance],
  );

  const usageLabels =
    model.input.usageBasis === "hours"
      ? {
          starting: "Starting usage",
          annual: "Expected annual usage",
          lifetime: "Expected useful life",
          suffix: "h",
          annualSuffix: "h/year",
        }
      : model.input.usageBasis === "kilometres"
        ? {
            starting: "Starting usage",
            annual: "Expected annual usage",
            lifetime: "Expected useful life",
            suffix: "km",
            annualSuffix: "km/year",
          }
        : {
            starting: "Starting life worked",
            annual: "Expected life worked at disposal",
            lifetime: "Useful life",
            suffix: "%",
            annualSuffix: "%",
          };

  function updateModel<K extends keyof LifecycleModelInput>(
    key: K,
    value: LifecycleModelInput[K],
  ) {
    setState((current) => {
      const nextModel = { ...current.modelInput, [key]: value };
      if (
        current.maintenanceYearsAutomatic &&
        (key === "ownershipYears" || key === "maintenanceStartAfterYears")
      ) {
        nextModel.maintenanceYears = Math.max(
          0,
          Number(nextModel.ownershipYears) - Number(nextModel.maintenanceStartAfterYears),
        );
      }
      return { ...current, modelInput: nextModel };
    });
  }

  function updateUsageBasis(value: LifecycleUsageBasis) {
    setState((current) => {
      const modelInput = { ...current.modelInput, usageBasis: value };
      if (value === "hours") {
        Object.assign(modelInput, {
          startingUsage: 0,
          annualUsage: 1_000,
          lifetimeUsage: 14_000,
          disposalLifeWorkedPct: 35,
          serviceInterval: 250,
        });
      } else if (value === "kilometres") {
        Object.assign(modelInput, {
          startingUsage: 0,
          annualUsage: 35_000,
          lifetimeUsage: 350_000,
          disposalLifeWorkedPct: 35,
          serviceInterval: 15_000,
        });
      } else {
        Object.assign(modelInput, {
          startingUsage: 0,
          annualUsage: 0,
          lifetimeUsage: 100,
          disposalLifeWorkedPct: 35,
          serviceInterval: 10,
        });
      }
      return {
        ...current,
        modelInput,
        stressAnnualUsage:
          value === "hours" ? 1_200 : value === "kilometres" ? 42_000 : 0,
      };
    });
  }

  function setMaintenanceAutomatic(value: boolean) {
    setState((current) => ({
      ...current,
      maintenanceYearsAutomatic: value,
      modelInput: value
        ? {
            ...current.modelInput,
            maintenanceYears: Math.max(
              0,
              current.modelInput.ownershipYears -
                current.modelInput.maintenanceStartAfterYears,
            ),
          }
        : current.modelInput,
    }));
  }

  function resetWorkspace() {
    if (window.confirm("Reset this lifecycle model to the example assumptions?")) {
      setState({ ...INITIAL_STATE, modelInput: { ...DEFAULT_LIFECYCLE_MODEL_INPUT } });
      setExportError("");
    }
  }

  async function exportFinancialModel() {
    setExporting(true);
    setExportError("");
    try {
      const response = await fetch("/api/admin/lifecycle-calculator/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...state,
          preferredScenario: state.preferredScenario,
        }),
      });
      if (!response.ok) throw new Error("Unable to generate the financial model.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const disposition = response.headers.get("Content-Disposition") ?? "";
      anchor.download = disposition.match(/filename="([^"]+)"/)?.[1] ?? "Aim4price-Lifecycle-Model.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Unable to export the model.");
    } finally {
      setExporting(false);
    }
  }

  const comparisonRows: Array<{
    label: string;
    strong?: boolean;
    render: (scenario: LifecycleScenarioSummary) => ReactNode;
  }> = [
    { label: "Asset incl. VAT", render: (scenario) => rand(scenario.assetAmount) },
    { label: "Service provision financed", render: (scenario) => rand(scenario.serviceFinanced) },
    { label: "Maintenance provision financed", render: (scenario) => rand(scenario.maintenanceFinanced) },
    { label: "Finance fees", render: (scenario) => rand(scenario.financeFees) },
    { label: "Less deposit", render: (scenario) => rand(scenario.deposit) },
    { label: "Amount financed", strong: true, render: (scenario) => rand(scenario.loan.principal) },
    { label: "Interest rate", render: () => `${numberFormat.format(model.input.annualRatePct)}%` },
    { label: "Finance term", render: () => `${model.input.financeTermMonths} months` },
    { label: "Effective balloon / residual", render: (scenario) => rand(scenario.loan.balloon) },
    { label: "Monthly instalment", strong: true, render: (scenario) => randCents(scenario.loan.monthlyPayment) },
    { label: "Total finance repayment", render: (scenario) => rand(scenario.loan.totalRepayment) },
    { label: "Total finance interest", render: (scenario) => rand(scenario.loan.totalInterest) },
    { label: "Service cash required later", render: (scenario) => scenario.serviceCashRequiredLater ? "Yes" : "No — provisioned" },
    { label: "Maintenance cash required later", render: (scenario) => scenario.maintenanceCashRequiredLater ? "Yes" : "No — provisioned" },
    { label: "Future retail value", render: () => rand(model.future.projectedRetail.grossAmount) },
    { label: "Conservative trade value", render: () => rand(model.future.tradeValue.grossAmount) },
    { label: "Settlement at disposal", render: (scenario) => rand(scenario.settlementAtDisposal) },
    { label: "Equity at disposal", strong: true, render: (scenario) => rand(scenario.equityAtDisposal) },
    { label: "Total lifecycle cash requirement", render: (scenario) => rand(scenario.totalLifecycleCashRequirement) },
    { label: "Net ownership cost after trade", render: (scenario) => rand(scenario.netOwnershipCostAfterTrade) },
    { label: `Cost per ${model.usageUnitLong}`, render: (scenario) => randCents(scenario.costPerUsageUnit) },
    { label: "Finance premium for liquidity", render: (scenario) => rand(scenario.financePremiumForLiquidity) },
    { label: "Working capital protected", render: (scenario) => rand(scenario.workingCapitalProtected) },
    { label: "Cash-flow predictability", render: (scenario) => scenario.predictability },
  ];

  return (
    <div className={styles.workspace}>
      <section className={styles.workspaceHeader}>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={resetWorkspace}>
            New
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => window.print()}
          >
            Print
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={exportFinancialModel}
            disabled={exporting}
          >
            {exporting ? "Preparing…" : "Export"}
          </button>
        </div>
      </section>
      {exportError ? <p className={styles.errorBanner}>{exportError}</p> : null}

      <nav className={styles.workspaceNav} aria-label="Lifecycle model sections">
        <a href="#lifecycle-setup"><b>1</b><span>Asset</span></a>
        <a href="#lifecycle-finance"><b>2</b><span>Finance</span></a>
        <a href="#lifecycle-provisions"><b>3</b><span>Provisions</span></a>
        <a href="#lifecycle-results"><b>4</b><span>Results</span></a>
        <a href="#lifecycle-planning"><b>5</b><span>Next cycle</span></a>
      </nav>

      <section className={styles.decisionPanel} aria-label="Key lifecycle answers">
        <div className={styles.decisionHeading}>
          <h3>Funding structure</h3>
        </div>
        <div className={styles.answerStrip}>
          {model.scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className={`${styles.scenarioChoice} ${scenario.id === state.preferredScenario ? styles.scenarioChoiceActive : ""}`}
              onClick={() => setState((current) => ({ ...current, preferredScenario: scenario.id }))}
              aria-pressed={scenario.id === state.preferredScenario}
            >
              {scenario.id === state.preferredScenario ? (
                <span className={styles.scenarioChoiceCheck} aria-hidden="true">✓</span>
              ) : null}
              <strong>{scenario.label}</strong>
              <b>{randCents(scenario.loan.monthlyPayment)} / month</b>
            </button>
          ))}
          <Metric
            label={`Retail value (${model.input.ownershipYears} years)`}
            value={rand(model.future.projectedRetail.grossAmount)}
            detail={`${numberFormat.format(model.future.projectedUsage)} ${model.usageUnit} projected usage`}
            tone="green"
          />
          <Metric
            label="Trade equity"
            value={rand(preferred.equityAtDisposal)}
            detail={`${rand(preferred.settlementAtDisposal)} settlement at disposal`}
            tone={preferred.equityAtDisposal >= 0 ? "green" : "red"}
          />
        </div>
      </section>

      <section id="lifecycle-setup" className={styles.assumptionGrid}>
        <article className={styles.card}>
          <SectionHeading
            eyebrow="1"
            title="Asset"
            description="A simple starting point—no catalogue or valuation wizard required."
          />
          <div className={styles.formGrid}>
            <TextField
              label="Client name (optional)"
              value={state.clientName}
              onChange={(value) => setState((current) => ({ ...current, clientName: value }))}
              placeholder="Client or business"
            />
            <TextField
              label="Asset description"
              value={state.assetDescription}
              onChange={(value) => setState((current) => ({ ...current, assetDescription: value }))}
              placeholder="Asset being modelled"
            />
            <NumericField
              label="Starting price"
              value={model.input.assetPrice}
              onChange={(value) => updateModel("assetPrice", value)}
              prefix="R"
              step={1_000}
            />
            <NumericField
              label="Purchase year"
              value={model.input.purchaseYear}
              onChange={(value) => updateModel("purchaseYear", value)}
              min={2000}
              max={new Date().getFullYear() + 10}
            />
          </div>
          <VatControl
            value={model.input.vatTreatment}
            onChange={(value) => updateModel("vatTreatment", value)}
          />
          <div className={styles.vatBreakdown}>
            <div><span>Ex VAT</span><strong>{rand(model.future.startingPrice.netAmount)}</strong></div>
            <div><span>VAT ({model.input.vatRatePct}%)</span><strong>{rand(model.future.startingPrice.vatAmount)}</strong></div>
            <div><span>Incl. VAT</span><strong>{rand(model.future.startingPrice.grossAmount)}</strong></div>
          </div>
          <div className={styles.formGrid}>
            <NumericField
              label="Planned ownership period"
              value={model.input.ownershipYears}
              onChange={(value) => updateModel("ownershipYears", value)}
              suffix="years"
              min={1}
              max={20}
              help="Independent from the finance term."
            />
            <SelectField<LifecycleUsageBasis>
              label="Usage basis"
              value={model.input.usageBasis}
              onChange={updateUsageBasis}
              options={[
                { value: "hours", label: "Hours" },
                { value: "kilometres", label: "Kilometres" },
                { value: "percentage", label: "Percentage worked" },
              ]}
            />
            <NumericField
              label={usageLabels.starting}
              value={model.input.startingUsage}
              onChange={(value) => updateModel("startingUsage", value)}
              suffix={usageLabels.suffix}
              max={model.input.usageBasis === "percentage" ? 100 : undefined}
            />
            {model.input.usageBasis === "percentage" ? (
              <NumericField
                label={usageLabels.annual}
                value={model.input.disposalLifeWorkedPct}
                onChange={(value) => updateModel("disposalLifeWorkedPct", value)}
                suffix="%"
                max={100}
              />
            ) : (
              <NumericField
                label={usageLabels.annual}
                value={model.input.annualUsage}
                onChange={(value) => updateModel("annualUsage", value)}
                suffix={usageLabels.annualSuffix}
                step={100}
              />
            )}
            {model.input.usageBasis !== "percentage" ? (
              <NumericField
                label={usageLabels.lifetime}
                value={model.input.lifetimeUsage}
                onChange={(value) => updateModel("lifetimeUsage", value)}
                suffix={usageLabels.suffix}
                min={1}
                step={500}
              />
            ) : null}
            <NumericField
              label="Asset / replacement price inflation"
              value={model.input.assetInflationPct}
              onChange={(value) => updateModel("assetInflationPct", value)}
              suffix="% / year"
              step={0.1}
            />
            <SelectField<ConditionKey>
              label="Expected condition at disposal"
              value={model.input.condition}
              onChange={(value) => updateModel("condition", value)}
              options={CONDITION_OPTIONS.map((option) => ({
                value: option.id,
                label: `${option.label} — ${option.description}`,
              }))}
            />
          </div>
        </article>

        <article id="lifecycle-finance" className={styles.card}>
          <SectionHeading
            eyebrow="2"
            title="Finance"
            description="Standard amortising finance. Ownership and finance terms remain separate."
          />
          <div className={styles.formGrid}>
            <NumericField
              label="Deposit"
              value={model.input.deposit}
              onChange={(value) => updateModel("deposit", value)}
              prefix="R"
              step={1_000}
            />
            <NumericField
              label="Interest rate"
              value={model.input.annualRatePct}
              onChange={(value) => updateModel("annualRatePct", value)}
              suffix="%"
              step={0.1}
            />
            <NumericField
              label="Finance term"
              value={model.input.financeTermMonths}
              onChange={(value) => updateModel("financeTermMonths", value)}
              suffix="months"
              min={1}
              max={180}
            />
            <NumericField
              label="Balloon / residual"
              value={model.input.balloon}
              onChange={(value) => updateModel("balloon", value)}
              prefix="R"
              step={1_000}
              max={standard.loan.principal}
              help={`Maximum ${rand(standard.loan.principal)} for Standard finance.`}
            />
            <NumericField
              label="Finance / initiation fees"
              value={model.input.financeFees}
              onChange={(value) => updateModel("financeFees", value)}
              prefix="R"
            />
          </div>
          <div className={styles.independenceNote}>
            <div>
              <span>Expected disposal year</span>
              <strong>{model.input.purchaseYear + model.input.ownershipYears}</strong>
            </div>
            <div>
              <span>Expected end of payment year</span>
              <strong>{model.input.purchaseYear + Math.ceil(model.input.financeTermMonths / 12)}</strong>
            </div>
          </div>
        </article>

        <aside className={`${styles.card} ${styles.futurePanel}`}>
          <SectionHeading
            eyebrow="Live"
            title="Future position"
            description="The valuation trail remains visible while assumptions change."
          />
          <div className={styles.positionRows}>
            <div><span>Starting new price incl. VAT</span><strong>{rand(model.future.startingPrice.grossAmount)}</strong></div>
            <div><span>Valuation basis ex VAT</span><strong>{rand(model.future.startingPrice.netAmount)}</strong></div>
            <div><span>Asset inflation</span><strong>{model.input.assetInflationPct}%</strong></div>
            <div><span>Ownership period</span><strong>{model.input.ownershipYears} years</strong></div>
            <div><span>Equivalent new price incl. VAT</span><strong>{rand(model.future.projectedReplacementPrice.grossAmount)}</strong></div>
            <div><span>Projected usage</span><strong>{numberFormat.format(model.future.projectedUsage)} {model.usageUnit}</strong></div>
            <div><span>Expected useful life</span><strong>{numberFormat.format(model.future.lifetimeUsage)} {model.usageUnit}</strong></div>
            <div><span>Age depreciation</span><strong>{model.future.ageDepreciationPct}%</strong></div>
            <div><span>Usage depreciation</span><strong>{numberFormat.format(model.future.usageDepreciationPct)}%</strong></div>
            <div><span>Condition</span><strong>{conditionLabel(model.input.condition)}</strong></div>
            <div><span>Condition factor</span><strong>{numberFormat.format(model.future.conditionFactor * 100)}%</strong></div>
            <div><span>Aim4price retail ex VAT</span><strong>{rand(model.future.projectedRetail.netAmount)}</strong></div>
            <div><span>Aim4price retail incl. VAT</span><strong>{rand(model.future.projectedRetail.grossAmount)}</strong></div>
            <div><span>Trade haircut</span><strong>{model.future.tradeHaircutPct}% · {rand(model.future.tradeHaircutAmount)}</strong></div>
            <div className={styles.positionTotal}><span>Projected trade value</span><strong>{rand(model.future.tradeValue.grossAmount)}</strong></div>
          </div>
        </aside>
      </section>

      <section id="lifecycle-provisions" className={styles.flowSectionLead}>
        <h2>Provisions · {rand(serviceScenario.serviceFinanced)} service · {rand(fullScenario.maintenanceFinanced)} maintenance</h2>
      </section>

      <section className={styles.provisionGrid}>
        <article className={styles.card}>
          <SectionHeading
            eyebrow="Service"
            title="Service"
            description="Define predictable scheduled servicing before deciding how it is funded."
          />
          <div className={styles.formGrid}>
            <SelectField<LifecycleServiceBasis>
              label="Service basis"
              value={model.input.serviceBasis}
              onChange={(value) => updateModel("serviceBasis", value)}
              options={[
                { value: "usage", label: "Usage interval" },
                { value: "calendar", label: "Calendar interval" },
                { value: "count", label: "Fixed number of services" },
                { value: "manual", label: "Manual package amount" },
              ]}
            />
            {model.input.serviceBasis === "usage" ? (
              <NumericField
                label={`Service interval (${model.usageUnit})`}
                value={model.input.serviceInterval}
                onChange={(value) => updateModel("serviceInterval", value)}
                suffix={model.usageUnit}
                min={1}
              />
            ) : null}
            {model.input.serviceBasis === "calendar" ? (
              <NumericField
                label="Calendar interval"
                value={model.input.serviceCalendarIntervalMonths}
                onChange={(value) => updateModel("serviceCalendarIntervalMonths", value)}
                suffix="months"
                min={1}
              />
            ) : null}
            {model.input.serviceBasis === "count" ? (
              <NumericField
                label="Fixed number of services"
                value={model.input.fixedServiceCount}
                onChange={(value) => updateModel("fixedServiceCount", value)}
                suffix="services"
              />
            ) : null}
            <NumericField
              label="Coverage / service-plan period"
              value={model.input.serviceCoverageYears}
              onChange={(value) => updateModel("serviceCoverageYears", value)}
              suffix="years"
              max={model.input.ownershipYears}
            />
            {model.input.serviceBasis !== "manual" ? (
              <NumericField
                label="Current cost per service"
                value={model.input.serviceCost}
                onChange={(value) => updateModel("serviceCost", value)}
                prefix="R"
              />
            ) : null}
          </div>
          {model.input.serviceBasis !== "manual" ? (
            <ToggleField
              label="Use a quoted service-plan amount"
              checked={model.input.useNegotiatedServiceAmount}
              onChange={(value) => updateModel("useNegotiatedServiceAmount", value)}
              help="Turn this off to use the calculated service cost."
            />
          ) : null}
          {model.input.serviceBasis === "manual" || model.input.useNegotiatedServiceAmount ? (
            <NumericField
              label="Quoted / planned service provision"
              value={model.input.negotiatedServiceAmount}
              onChange={(value) => updateModel("negotiatedServiceAmount", value)}
              prefix="R"
              step={1_000}
              help="Enter the amount quoted for this deal."
            />
          ) : null}
          <div className={styles.metricGrid}>
            <Metric label="Calculated services" value={String(model.service.serviceCount)} detail={`${model.service.servicesPerYear} per year`} />
            <Metric label="Calculated service cost" value={rand(model.service.calculated.grossAmount)} detail="Incl. VAT" />
            <Metric label="Selected service provision" value={rand(model.service.selected.grossAmount)} detail={`${rand(model.service.selected.netAmount)} ex VAT`} tone="green" />
            <Metric label="Future pay-as-you-go estimate" value={rand(model.service.nominalPayAsYouGo)} detail="Timing-adjusted inflation" />
          </div>
        </article>

        <article className={styles.card}>
          <SectionHeading
            eyebrow="Maintenance"
            title="Maintenance"
            description="Reserve money for post-warranty wear, parts and approved repairs."
          />
          <div className={styles.formGrid}>
            <NumericField
              label="Start after"
              value={model.input.maintenanceStartAfterYears}
              onChange={(value) => updateModel("maintenanceStartAfterYears", value)}
              suffix="years"
              max={model.input.ownershipYears}
            />
            <NumericField
              label="Expected maintenance events"
              value={model.input.maintenanceEventsPerYear}
              onChange={(value) => updateModel("maintenanceEventsPerYear", value)}
              suffix="per year"
              step={0.5}
            />
            <NumericField
              label="Current cost per event"
              value={model.input.maintenanceCostPerEvent}
              onChange={(value) => updateModel("maintenanceCostPerEvent", value)}
              prefix="R"
            />
            <NumericField
              label="Planned maintenance reserve"
              value={model.input.negotiatedMaintenanceReserve}
              onChange={(value) => updateModel("negotiatedMaintenanceReserve", value)}
              prefix="R"
              step={1_000}
              help="Enter the reserve agreed for this ownership period."
            />
            <NumericField
              label="Maintenance / parts inflation"
              value={model.input.maintenanceInflationPct}
              onChange={(value) => updateModel("maintenanceInflationPct", value)}
              suffix="% / year"
              step={0.1}
            />
          </div>
          <ToggleField
            label="Automatically use the remaining ownership period"
            checked={state.maintenanceYearsAutomatic}
            onChange={setMaintenanceAutomatic}
            help={`${model.input.ownershipYears} ownership years less ${model.input.maintenanceStartAfterYears} years before maintenance provision starts.`}
          />
          {!state.maintenanceYearsAutomatic ? (
            <NumericField
              label="Maintenance provision period"
              value={model.input.maintenanceYears}
              onChange={(value) => updateModel("maintenanceYears", value)}
              suffix="years"
              max={Math.max(0, model.input.ownershipYears - model.input.maintenanceStartAfterYears)}
            />
          ) : null}
          <div className={styles.metricGrid}>
            <Metric label="Calculated events" value={String(model.maintenance.eventCount)} detail={`${model.maintenance.years} provision years`} />
            <Metric label="Current-money requirement" value={rand(model.maintenance.currentMoneyRequirement.grossAmount)} detail="Before future inflation" />
            <Metric label="Future pay-as-you-go estimate" value={rand(model.maintenance.nominalPayAsYouGo)} detail="Inflated at event timing" />
            <Metric label="Selected reserve" value={rand(model.maintenance.selectedReserve.grossAmount)} detail={`${rand(model.maintenance.selectedReserve.netAmount)} ex VAT`} tone="green" />
            <Metric
              label="Reserve vs future pay-as-you-go"
              value={rand(Math.abs(model.maintenance.inflationAvoided))}
              detail={model.maintenance.inflationAvoided >= 0 ? "Estimated saving from fixing the reserve now" : "Reserve is above estimated future spend"}
              tone={model.maintenance.inflationAvoided >= 0 ? "green" : "amber"}
            />
          </div>
        </article>
      </section>

      <section id="lifecycle-results" className={styles.resultsLead}>
        <div>
          <h2>Results</h2>
        </div>
        <div>
          <span>Preferred monthly payment</span>
          <strong>{randCents(preferred.loan.monthlyPayment)}</strong>
        </div>
      </section>

      <section className={`${styles.card} ${styles.comparisonSection}`}>
        <SectionHeading
          eyebrow="Main comparison"
          title="Structure comparison"
          description="All structures remain calculated. Selection only highlights the preferred ownership structure."
        />
        <div className={styles.comparisonWrap}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th>Lifecycle measure</th>
                {model.scenarios.map((scenario) => (
                  <th
                    key={scenario.id}
                    className={scenario.id === state.preferredScenario ? styles.preferredColumn : ""}
                  >
                    <span>{scenario.label}</span>
                    <button
                      type="button"
                      className={scenario.id === state.preferredScenario ? styles.structureSelected : ""}
                      onClick={() => setState((current) => ({ ...current, preferredScenario: scenario.id }))}
                    >
                      {scenario.id === state.preferredScenario ? "✓ Preferred structure" : "Use this structure"}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  {model.scenarios.map((scenario) => (
                    <ComparisonCell
                      key={scenario.id}
                      scenario={scenario}
                      preferredScenario={state.preferredScenario}
                      strong={row.strong}
                    >
                      {row.render(scenario)}
                    </ComparisonCell>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="lifecycle-cash-flow" className={`${styles.card} ${styles.cashFlowSection}`}>
        <SectionHeading
          eyebrow="Timing"
          title="Annual cash flow"
          description="Shows when finance, service and maintenance cash actually leave the business."
        />
        <div className={styles.comparisonWrap}>
          <table className={styles.cashFlowTable}>
            <thead>
              <tr>
                <th>Year</th>
                {model.scenarios.map((scenario) => (
                  <th key={scenario.id}>{scenario.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {standard.cashFlow.map((year, index) => (
                <tr key={year.year}>
                  <th>Year {year.year}</th>
                  {model.scenarios.map((scenario) => (
                    <td key={scenario.id} className={scenario.id === state.preferredScenario ? styles.preferredColumn : ""}>
                      {rand(scenario.cashFlow[index].totalAnnualCash)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th>Total during ownership</th>
                {model.scenarios.map((scenario) => (
                  <td key={scenario.id} className={scenario.id === state.preferredScenario ? styles.preferredColumn : ""}>
                    <strong>{rand(scenario.totalLifecycleCashRequirement)}</strong>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <details className={styles.inlineDetails}>
          <summary>View detailed annual cash rows</summary>
          <div className={styles.comparisonWrap}>
            <table className={styles.detailTable}>
              <thead>
                <tr><th>Structure</th><th>Year</th><th>Deposit</th><th>Finance</th><th>Service cash</th><th>Maintenance cash</th><th>Total</th><th>Cumulative</th></tr>
              </thead>
              <tbody>
                {model.scenarios.flatMap((scenario) =>
                  scenario.cashFlow.map((year) => (
                    <tr key={`${scenario.id}-${year.year}`}>
                      <td>{scenario.label}</td><td>{year.year}</td><td>{rand(year.depositPayment)}</td><td>{rand(year.loanPayments)}</td><td>{rand(year.serviceCashPayments)}</td><td>{rand(year.maintenanceCashPayments)}</td><td>{rand(year.totalAnnualCash)}</td><td>{rand(year.cumulativeCash)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section id="lifecycle-planning" className={styles.flowSectionLead}>
        <h2>Next cycle · {rand(preferred.equityAtDisposal)} projected equity</h2>
      </section>

      <section className={styles.outcomeGrid}>
        <article className={styles.card}>
          <SectionHeading
            eyebrow="Equity"
            title="Equity position"
            description="Trade value less the remaining settlement at planned disposal."
          />
          <div className={styles.equityHero}>
            <div><span>Projected replacement price</span><strong>{rand(model.future.projectedReplacementPrice.grossAmount)}</strong></div>
            <div><span>Projected Aim4price retail</span><strong>{rand(model.future.projectedRetail.grossAmount)}</strong></div>
            <div><span>Projected trade value</span><strong>{rand(model.future.tradeValue.grossAmount)}</strong></div>
          </div>
          <div className={styles.equityRows}>
            {model.scenarios.map((scenario) => (
              <div key={scenario.id} className={scenario.id === state.preferredScenario ? styles.equityPreferred : ""}>
                <span>{scenario.label}</span>
                <strong>{rand(scenario.equityAtDisposal)} equity</strong>
              </div>
            ))}
          </div>
          <div className={styles.tradeControls}>
            <SelectField
              label="Trade value method"
              value={model.input.tradeMode}
              onChange={(value) => updateModel("tradeMode", value)}
              options={[
                { value: "haircut", label: "Percentage haircut from Aim4price retail" },
                { value: "manual", label: "Manual trade value" },
                { value: "dealer", label: "Direct dealer offer" },
              ]}
            />
            {model.input.tradeMode === "haircut" ? (
              <NumericField label="Trade haircut" value={model.input.tradeHaircutPct} onChange={(value) => updateModel("tradeHaircutPct", value)} suffix="%" step={0.5} max={100} />
            ) : model.input.tradeMode === "manual" ? (
              <NumericField label="Manual trade value" value={model.input.manualTradeValue} onChange={(value) => updateModel("manualTradeValue", value)} prefix="R" />
            ) : (
              <NumericField label="Dealer offer" value={model.input.dealerOffer} onChange={(value) => updateModel("dealerOffer", value)} prefix="R" />
            )}
          </div>
        </article>

        <article className={`${styles.card} ${styles.nextCycleCard}`}>
          <SectionHeading
            eyebrow="Replacement"
            title="Replacement plan"
            description="Allocate disposal equity to the next service provision, reserve and deposit."
          />
          <div className={styles.formGrid}>
            <NumericField label="Next service provision" value={state.nextServiceAllocation} onChange={(value) => setState((current) => ({ ...current, nextServiceAllocation: value }))} prefix="R" />
            <NumericField label="Next maintenance reserve" value={state.nextMaintenanceAllocation} onChange={(value) => setState((current) => ({ ...current, nextMaintenanceAllocation: value }))} prefix="R" />
          </div>
          <div className={styles.nextCycleFlow}>
            <div><span>{preferred.label} equity</span><strong>{rand(preferred.equityAtDisposal)}</strong></div>
            <i>→</i>
            <div><span>Service allocation</span><strong>{rand(nextCycle.serviceAllocation)}</strong></div>
            <i>→</i>
            <div><span>Maintenance allocation</span><strong>{rand(nextCycle.reserveAllocation)}</strong></div>
            <i>→</i>
            <div><span>Replacement deposit</span><strong>{rand(nextCycle.remainingDeposit)}</strong></div>
          </div>
          <div className={styles.metricGrid}>
            <Metric label="Next equivalent asset price" value={rand(nextCycle.nextAssetPrice)} detail={`${model.input.assetInflationPct}% inflation over ${model.input.ownershipYears} years`} />
            <Metric label="Next financed amount" value={rand(nextCycle.nextFinancedAmount)} tone="green" />
            <Metric label="Negative equity shortfall" value={rand(nextCycle.negativeEquityShortfall)} tone={nextCycle.negativeEquityShortfall > 0 ? "red" : "green"} />
            <Metric label="Allocation shortfall" value={rand(nextCycle.allocationShortfall)} tone={nextCycle.allocationShortfall > 0 ? "red" : "green"} />
          </div>
        </article>
      </section>

      <section id="lifecycle-advanced" className={styles.advancedGrid}>
        <details className={styles.card}>
          <summary>
            <SectionHeading eyebrow="Optional" title="Refinance / Cash-Flow Stress Test" description="Test a proactive restructure before missed payments occur." />
          </summary>
          <div className={styles.detailsBody}>
            <VatControl
              value={model.input.vatTreatment}
              onChange={(value) => updateModel("vatTreatment", value)}
            />
            <div className={styles.vatBreakdown}>
              <div><span>Preferred package ex VAT</span><strong>{rand(model.packageVat[preferred.id].netAmount)}</strong></div>
              <div><span>VAT</span><strong>{rand(model.packageVat[preferred.id].vatAmount)}</strong></div>
              <div><span>Preferred package incl. VAT</span><strong>{rand(model.packageVat[preferred.id].grossAmount)}</strong></div>
            </div>
            <div className={styles.formGrid}>
              <NumericField label="Review point" value={state.refinanceMonth} onChange={(value) => setState((current) => ({ ...current, refinanceMonth: value }))} suffix="months" min={1} max={model.input.financeTermMonths} />
              <NumericField label="New interest rate" value={state.refinanceRatePct} onChange={(value) => setState((current) => ({ ...current, refinanceRatePct: value }))} suffix="%" step={0.1} />
              <NumericField label="New remaining term" value={state.refinanceTermMonths} onChange={(value) => setState((current) => ({ ...current, refinanceTermMonths: value }))} suffix="months" min={1} max={180} />
              <NumericField label="New balloon" value={state.refinanceBalloon} onChange={(value) => setState((current) => ({ ...current, refinanceBalloon: value }))} prefix="R" />
            </div>
            <div className={styles.metricGrid}>
              <Metric label="Settlement at review" value={rand(refinance.settlementAmount)} />
              <Metric label="Current instalment" value={randCents(refinance.currentMonthlyPayment)} />
              <Metric label="Refinanced instalment" value={randCents(refinance.newMonthlyPayment)} />
              <Metric label="Monthly cash-flow relief" value={randCents(refinance.monthlyRelief)} tone={refinance.monthlyRelief >= 0 ? "green" : "amber"} />
              <Metric label="Additional total finance cost" value={rand(refinance.additionalCost)} />
            </div>
            <p className={styles.disclaimer}>Refinancing remains subject to lender approval, affordability, credit record, asset condition, valuation and prevailing rates.</p>
          </div>
        </details>

        <details className={styles.card}>
          <summary>
            <SectionHeading eyebrow="Optional" title="Sensitivity / Stress Testing" description="Compare the base assumptions with a conservative midpoint and configurable stress case." />
          </summary>
          <div className={styles.detailsBody}>
            <div className={styles.formGrid}>
              <NumericField label="Stress interest rate" value={state.stressInterestRatePct} onChange={(value) => setState((current) => ({ ...current, stressInterestRatePct: value }))} suffix="%" step={0.1} />
              <NumericField label="Stress asset inflation" value={state.stressAssetInflationPct} onChange={(value) => setState((current) => ({ ...current, stressAssetInflationPct: value }))} suffix="%" step={0.1} />
              <NumericField label="Stress maintenance inflation" value={state.stressMaintenanceInflationPct} onChange={(value) => setState((current) => ({ ...current, stressMaintenanceInflationPct: value }))} suffix="%" step={0.1} />
              <NumericField label="Stress trade haircut" value={state.stressTradeHaircutPct} onChange={(value) => setState((current) => ({ ...current, stressTradeHaircutPct: value }))} suffix="%" max={100} />
              <NumericField label="Stress ownership period" value={state.stressOwnershipYears} onChange={(value) => setState((current) => ({ ...current, stressOwnershipYears: value }))} suffix="years" min={1} max={20} />
              {model.input.usageBasis !== "percentage" ? (
                <NumericField label="Stress annual usage" value={state.stressAnnualUsage} onChange={(value) => setState((current) => ({ ...current, stressAnnualUsage: value }))} suffix={usageLabels.annualSuffix} />
              ) : null}
              <SelectField label="Stress end condition" value={state.stressCondition} onChange={(value) => setState((current) => ({ ...current, stressCondition: value }))} options={CONDITION_OPTIONS.map((option) => ({ value: option.id, label: option.label }))} />
            </div>
            <div className={styles.comparisonWrap}>
              <table className={styles.sensitivityTable}>
                <thead><tr><th>Preferred structure: {preferred.label}</th>{sensitivity.map((entry) => <th key={entry.label}>{entry.label}</th>)}</tr></thead>
                <tbody>
                  {[
                    ["Monthly instalment", (scenario: LifecycleScenarioSummary) => randCents(scenario.loan.monthlyPayment)],
                    ["Future retail", (_scenario: LifecycleScenarioSummary, caseModel: typeof model) => rand(caseModel.future.projectedRetail.grossAmount)],
                    ["Trade value", (_scenario: LifecycleScenarioSummary, caseModel: typeof model) => rand(caseModel.future.tradeValue.grossAmount)],
                    ["Equity", (scenario: LifecycleScenarioSummary) => rand(scenario.equityAtDisposal)],
                    ["Lifecycle cost", (scenario: LifecycleScenarioSummary) => rand(scenario.netOwnershipCostAfterTrade)],
                  ].map(([label, formatter]) => (
                    <tr key={label as string}>
                      <th>{label as string}</th>
                      {sensitivity.map((entry) => {
                        const scenario = entry.model.scenarios.find((item) => item.id === preferred.id) ?? entry.model.scenarios[0];
                        return <td key={entry.label}>{(formatter as (scenario: LifecycleScenarioSummary, caseModel: typeof model) => string)(scenario, entry.model)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

      <section className={`${styles.card} ${styles.dealerSection}`}>
        <ToggleField
          label="Include internal Dealer Economics"
          checked={state.includeDealerEconomics}
          onChange={(value) => setState((current) => ({ ...current, includeDealerEconomics: value }))}
          help="Admin-only internal analysis; excluded from the workbook unless enabled."
        />
        {state.includeDealerEconomics ? (
          <div className={styles.dealerBody}>
            <SectionHeading eyebrow="Internal" title="Dealer Economics" description="Revenue is not treated as profit; the configured gross margin determines service and maintenance contribution." />
            <div className={styles.formGrid}>
              <NumericField label="Trade allowance" value={state.dealerTradeAllowance} onChange={(value) => setState((current) => ({ ...current, dealerTradeAllowance: value }))} prefix="R" />
              <NumericField label="Expected resale" value={state.dealerExpectedResale} onChange={(value) => setState((current) => ({ ...current, dealerExpectedResale: value }))} prefix="R" />
              <NumericField label="Reconditioning cost" value={state.dealerReconCost} onChange={(value) => setState((current) => ({ ...current, dealerReconCost: value }))} prefix="R" />
              <NumericField label="Holding cost" value={state.dealerHoldingCost} onChange={(value) => setState((current) => ({ ...current, dealerHoldingCost: value }))} prefix="R" />
              <NumericField label="Service / maintenance gross margin" value={state.dealerGrossMarginPct} onChange={(value) => setState((current) => ({ ...current, dealerGrossMarginPct: value }))} suffix="%" />
              <NumericField label="New asset gross contribution" value={state.dealerNewAssetProfit} onChange={(value) => setState((current) => ({ ...current, dealerNewAssetProfit: value }))} prefix="R" />
              <NumericField label="Risk reserve" value={state.dealerRiskReserve} onChange={(value) => setState((current) => ({ ...current, dealerRiskReserve: value }))} prefix="R" />
            </div>
            <div className={styles.comparisonWrap}>
              <table className={styles.dealerTable}>
                <thead><tr><th>Dealer economics</th>{dealerScenarios.map((scenario) => <th key={scenario.id}>{scenario.label}</th>)}</tr></thead>
                <tbody>
                  <tr><th>New asset contribution</th>{dealerScenarios.map((scenario) => <td key={scenario.id}>{rand(scenario.economics.newTractorContribution)}</td>)}</tr>
                  <tr><th>Service / maintenance contribution</th>{dealerScenarios.map((scenario) => <td key={scenario.id}>{rand(scenario.economics.servicePartsContribution)}</td>)}</tr>
                  <tr><th>Trade contribution</th>{dealerScenarios.map((scenario) => <td key={scenario.id}>{rand(scenario.economics.tradeContribution)}</td>)}</tr>
                  <tr><th>Gross commercial contribution</th>{dealerScenarios.map((scenario) => <td key={scenario.id}>{rand(scenario.economics.totalGrossContribution)}</td>)}</tr>
                  <tr><th>Risk reserve</th>{dealerScenarios.map((scenario) => <td key={scenario.id}>{rand(scenario.economics.riskReserve)}</td>)}</tr>
                  <tr><th>Commercial buffer</th>{dealerScenarios.map((scenario) => <td key={scenario.id}><strong>{rand(scenario.economics.commercialBuffer)}</strong></td>)}</tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <footer className={styles.footerDisclaimer}>
        Aim4price calculations are indicative scenario estimates and do not constitute a lending decision,
        guaranteed valuation, tax advice, refinance approval or offer to purchase. Actual finance,
        maintenance, resale and equity outcomes depend on the relevant provider and future asset condition.
      </footer>
    </div>
  );
}
