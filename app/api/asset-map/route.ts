import { NextResponse } from "next/server";
import { getServerSession } from "../../../lib/auth-session";
import {
  listAssetRegisterItems,
  type AssetRegisterItem,
} from "../../../lib/asset-register-db";
import {
  listAssetRegisters,
  type AssetRegisterSummary,
} from "../../../lib/asset-registers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AssetStatusChoice = "yes" | "no" | "unknown" | "not_applicable";
type AssetMapUsageMetric = "hours" | "km" | "percentage" | null;

type AssetMapRegisterContext = {
  id: string;
  label: string;
};

type AssetMapFilterOption = {
  id: string;
  label: string;
  registerId: string | null;
};

type AssetMapItem = {
  id: string;
  registerId: string;
  registerName: string;
  registerLabel: string;
  title: string;
  kind: string;
  assetTypeLabel: string;
  plateLabel: string;
  publicAssetCode: string;
  qrStatus: string;
  condition: string;
  financeStatus: AssetStatusChoice;
  insuranceStatus: AssetStatusChoice;
  licenseStatus: AssetStatusChoice;
  licenseRegistrationNumber: string;
  value: number;
  selectedMethod: string;
  replacementPriceExVat: number | null;
  hours: number | null;
  lifeWorkedPercent: number | null;
  usageMetric: AssetMapUsageMetric;
  usageDisplay: string;
  fuelPercent: number | null;
  serialNumber: string;
  brandName: string;
  modelName: string;
  typedModelName: string;
  yearModel: number | null;
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  updatedAtIso: string;
  photos: string[];
};

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "You must be signed in." },
    { status: 401 },
  );
}

function hasCoordinates(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRegisterLabel(
  register: AssetRegisterSummary,
  index: number,
): string {
  return cleanText(register.businessName) || `Asset Register #${index + 1}`;
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAssetStatusChoice(
  value: unknown,
  fallback: AssetStatusChoice = "unknown",
): AssetStatusChoice {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (
    [
      "yes",
      "y",
      "true",
      "financed",
      "insured",
      "licensed",
      "licenced",
    ].includes(normalized)
  ) {
    return "yes";
  }

  if (
    [
      "no",
      "n",
      "false",
      "not_financed",
      "not_insured",
      "not_licensed",
      "not_licenced",
      "unfinanced",
      "uninsured",
      "unlicensed",
      "unlicenced",
    ].includes(normalized)
  ) {
    return "no";
  }

  if (
    [
      "na",
      "n_a",
      "not_applicable",
      "not_aplicable",
      "not_relevant",
      "does_not_apply",
    ].includes(normalized)
  ) {
    return "not_applicable";
  }

  if (["unknown", "not_sure", "unsure", "maybe", ""].includes(normalized)) {
    return normalized ? "unknown" : fallback;
  }

  return fallback;
}

function readFinanceStatusChoice(item: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.financeStatus ??
      specs.finance_status ??
      specs.financedStatus ??
      specs.financed_status,
    item.isFinanced ? "yes" : "no",
  );
}

function readInsuranceStatusChoice(item: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.insuranceStatus ??
      specs.insurance_status ??
      specs.insuredStatus ??
      specs.insured_status,
    item.isInsured ? "yes" : "no",
  );
}

function readLicenseStatusChoice(item: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.licenseStatus ??
      specs.license_status ??
      specs.licensedStatus ??
      specs.licensed_status ??
      specs.licenceStatus ??
      specs.licence_status ??
      specs.licencedStatus ??
      specs.licenced_status,
    item.isLicensed ? "yes" : "no",
  );
}

function readLicenseRegistrationNumber(item: AssetRegisterItem): string {
  const direct = String(item.licenseRegistrationNumber ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (direct) return direct;

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return String(
    specs.licenseRegistrationNumber ??
      specs.license_registration_number ??
      specs.licenceRegistrationNumber ??
      specs.licence_registration_number ??
      specs.licenseRegistration ??
      specs.license_registration ??
      specs.licenceRegistration ??
      specs.licence_registration ??
      specs.registrationNumber ??
      specs.registration_number ??
      specs.numberPlate ??
      specs.number_plate ??
      specs.numberplate ??
      "",
  )
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function buildAssetTypeLabel(item: AssetRegisterItem): string {
  const family = String(item.equipmentFamilyLabel ?? "").trim();
  if (family) return family;

  const kind = String(item.kind ?? "").trim();
  if (kind) return titleCase(kind);

  return "Asset";
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]+/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-ZA").format(Math.round(value));
}

function formatPercent(value: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  const rounded = Math.round(clamped * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function isPercentUsageModeValue(value: unknown): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return (
    normalized === "percent" ||
    normalized === "percentage" ||
    normalized === "percent_used" ||
    normalized === "percentage_used" ||
    normalized === "percentage_depreciation" ||
    normalized === "life_worked_percent" ||
    normalized === "worked_percent" ||
    normalized === "lifetime_percent" ||
    normalized === "wear_class"
  );
}

function assetUsesPercentUsage(item: AssetRegisterItem): boolean {
  if (item.kind === "vehicle") return false;

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};
  const percent = numericValue(item.lifeWorkedPercent);
  const usageReading = numericValue(item.hours);
  const hasPositiveUsageReading = usageReading !== null && usageReading > 0;
  const depreciationMethod = String(
    item.depreciationMethodUsed ??
      specs.depreciationMethodUsed ??
      specs.depreciation_method_used ??
      specs.selectedDepreciationMethod ??
      specs.selected_depreciation_method ??
      "",
  )
    .trim()
    .toLowerCase();

  const usageModeValues = [
    specs.usageMode,
    specs.usage_mode,
    specs.usageBasis,
    specs.usage_basis,
    specs.usageMetricType,
    specs.usage_metric_type,
    specs.valuationMode,
    specs.valuation_mode,
    specs.selectedUsageMode,
    specs.selected_usage_mode,
    specs.selectedUsageBasis,
    specs.selected_usage_basis,
    specs.depreciationMethodUsed,
    specs.depreciation_method_used,
    specs.selectedDepreciationMethod,
    specs.selected_depreciation_method,
  ];

  if (usageModeValues.some(isPercentUsageModeValue)) {
    return true;
  }

  if (depreciationMethod === "percentage_depreciation") {
    return true;
  }

  return (
    percent !== null &&
    (!hasPositiveUsageReading || depreciationMethod === "semi_depreciation")
  );
}

function readUsageMetric(item: AssetRegisterItem): AssetMapUsageMetric {
  if (assetUsesPercentUsage(item)) return "percentage";
  if (item.kind === "vehicle") return "km";

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};
  const rawUsage = String(
    specs.usageMetric ??
      specs.usage_metric ??
      specs.usageUnit ??
      specs.usage_unit ??
      specs.usage_measure ??
      specs.usageMetricType ??
      specs.usage_metric_type ??
      specs.usageMode ??
      specs.usage_mode ??
      specs.usageBasis ??
      specs.usage_basis ??
      "",
  )
    .trim()
    .toLowerCase();

  if (isPercentUsageModeValue(rawUsage)) return "percentage";

  if (
    rawUsage === "km" ||
    rawUsage === "kms" ||
    rawUsage === "kilometres" ||
    rawUsage === "kilometers" ||
    rawUsage === "odometer" ||
    rawUsage === "odometer_reading"
  ) {
    return "km";
  }

  if (
    rawUsage === "hours" ||
    rawUsage === "hour" ||
    rawUsage === "hrs" ||
    rawUsage === "engine_hours" ||
    rawUsage === "machine_hours"
  ) {
    return "hours";
  }

  if (item.kind === "tractor" || item.kind === "equipment") return "hours";
  if (numericValue(item.hours) !== null) return "hours";

  return null;
}

function formatUsageDisplay(item: AssetRegisterItem): string {
  const usageMetric = readUsageMetric(item);
  const usageReading = numericValue(item.hours);
  const lifeWorkedPercent = numericValue(item.lifeWorkedPercent);

  if (usageMetric === "percentage") {
    return lifeWorkedPercent === null
      ? "Usage not saved"
      : `${formatPercent(lifeWorkedPercent)}% worked`;
  }

  if (usageReading !== null) {
    return `${formatNumber(usageReading)} ${usageMetric === "km" ? "km" : "hours"}`;
  }

  if (lifeWorkedPercent !== null) {
    return `${formatPercent(lifeWorkedPercent)}% worked`;
  }

  return "Usage not saved";
}

function mapAssetForMap(
  item: AssetRegisterItem,
  register: AssetMapRegisterContext,
): AssetMapItem {
  return {
    id: item.id,
    registerId: register.id,
    registerName: register.label,
    registerLabel: register.label,
    title: item.title,
    kind: item.kind,
    assetTypeLabel: buildAssetTypeLabel(item),
    plateLabel: item.plateLabel,
    publicAssetCode: item.publicAssetCode,
    qrStatus: item.qrStatus,
    condition: item.condition,
    financeStatus: readFinanceStatusChoice(item),
    insuranceStatus: readInsuranceStatusChoice(item),
    licenseStatus: readLicenseStatusChoice(item),
    licenseRegistrationNumber: readLicenseRegistrationNumber(item),
    value: item.value,
    selectedMethod: item.selectedMethod,
    replacementPriceExVat: item.replacementPriceExVat,
    hours: item.hours,
    lifeWorkedPercent: item.lifeWorkedPercent,
    usageMetric: readUsageMetric(item),
    usageDisplay: formatUsageDisplay(item),
    fuelPercent: item.fuelPercent,
    serialNumber: item.serialNumber,
    brandName: item.brandName,
    modelName: item.modelName,
    typedModelName: item.typedModelName,
    yearModel: item.yearModel,
    lastScannedAtIso: item.lastScannedAtIso,
    lastKnownLat: item.lastKnownLat,
    lastKnownLng: item.lastKnownLng,
    lastKnownLocationText: item.lastKnownLocationText,
    updatedAtIso: item.updatedAtIso,
    photos: Array.isArray(item.photos)
      ? item.photos.filter((photo) => typeof photo === "string" && photo.trim())
      : [],
  };
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const registers = await listAssetRegisters(session.user.id);
    const registerContexts: AssetMapRegisterContext[] = registers.map(
      (register, index) => ({
        id: register.id,
        label: buildRegisterLabel(register, index),
      }),
    );

    const registerBundles = await Promise.all(
      registerContexts.map(async (register) => ({
        register,
        items: await listAssetRegisterItems(session.user.id, register.id),
      })),
    );

    const assets = registerBundles.flatMap(({ register, items }) =>
      items.map((item) => mapAssetForMap(item, register)),
    );
    const mappedAssets = assets.filter((asset) =>
      hasCoordinates(asset.lastKnownLat, asset.lastKnownLng),
    );
    const activeMappedAssets = mappedAssets.filter(
      (asset) => asset.qrStatus !== "deleted",
    );
    const recentlyScannedAssets = assets.filter((asset) => {
      if (!asset.lastScannedAtIso) return false;
      const scannedAt = new Date(asset.lastScannedAtIso).getTime();
      if (Number.isNaN(scannedAt)) return false;
      return Date.now() - scannedAt <= 1000 * 60 * 60 * 24 * 30;
    });

    const registerFilters: AssetMapFilterOption[] = [
      { id: "all", label: "All Assets", registerId: null },
      ...registerContexts.map((register) => ({
        id: register.id,
        label: register.label,
        registerId: register.id,
      })),
    ];

    return NextResponse.json({
      ok: true,
      assets,
      registerFilters,
      summary: {
        totalAssets: assets.length,
        assetsWithLocation: mappedAssets.length,
        assetsWithoutLocation: Math.max(0, assets.length - mappedAssets.length),
        activeMappedAssets: activeMappedAssets.length,
        scannedLast30Days: recentlyScannedAssets.length,
      },
    });
  } catch (error) {
    console.error("asset map GET failed", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load the asset map.",
      },
      { status: 500 },
    );
  }
}
