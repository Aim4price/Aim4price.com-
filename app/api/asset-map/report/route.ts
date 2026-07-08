import { NextResponse } from "next/server";
import { getServerSession } from "../../../../lib/auth-session";
import {
  listAssetRegisterItems,
  type AssetRegisterItem,
} from "../../../../lib/asset-register-db";
import {
  getAssetRegisterReportLogoUrl,
  listAssetRegisters,
  type AssetRegisterSummary,
} from "../../../../lib/asset-registers";
import {
  createXlsxWorkbook,
  type XlsxCellStyle,
  type XlsxCellValue,
  type XlsxSheet,
} from "../../../../lib/simple-xlsx";
import { resolveReportLogoUrlForHtml } from "../../../../lib/report-logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AssetStatusChoice = "yes" | "no" | "unknown" | "not_applicable";

type AssetMapRegisterContext = {
  id: string;
  label: string;
  index: number;
};

type SourcedAsset = {
  item: AssetRegisterItem;
  registerId: string;
  registerName: string;
  registerIndex: number;
};

type PrintableAsset = {
  number: number;
  title: string;
  plateLabel: string;
  publicAssetCode: string;
  serialNumber: string;
  assetTypeLabel: string;
  registerId: string;
  registerName: string;
  yearModel: string;
  currentValueRaw: number | null;
  currentValue: string;
  replacementValueRaw: number | null;
  replacementValue: string;
  insuredValueRaw: number | null;
  insuredValue: string;
  fuel: string;
  financed: string;
  insured: string;
  licensed: string;
  licenseRegistrationNumber: string;
  usage: string;
  condition: string;
  lastScanned: string;
  locationText: string;
  photoUrls: string[];
  latitude: number;
  longitude: number;
  latLngText: string;
  googleMapsUrl: string;
};

type AssetReportSelection = {
  codes: string[];
  ids: string[];
};

type ScopedAssetResult = {
  assets: SourcedAsset[];
  scopeLabel: string;
  scopeSegment: string;
  selectedAssetMode: boolean;
};

const DEFAULT_CENTER: [number, number] = [-29.0, 24.0];
const REPLACEMENT_PRICE_SPEC_KEYS = [
  "replacementPriceExVat",
  "replacement_price_ex_vat",
  "replacementPriceUsedExVat",
  "replacement_price_used_ex_vat",
  "userReplacementPriceExVat",
  "user_replacement_price_ex_vat",
  "officialReplacementPriceExVat",
  "official_replacement_price_ex_vat",
  "replacementPrice",
  "replacement_price",
] as const;
const INSURED_VALUE_SPEC_KEYS = [
  "insuredValueExVat",
  "insured_value_ex_vat",
  "insuranceValueExVat",
  "insurance_value_ex_vat",
  "insuredValue",
  "insured_value",
  "insuranceValue",
  "insurance_value",
] as const;

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "You must be signed in." },
    { status: 401 },
  );
}

function asText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function formatDate(value = new Date()): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatTime(value = new Date()): string {
  return new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Not scanned";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not scanned";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatFileDate(value = new Date()): string {
  return value.toISOString().slice(0, 10);
}

function formatFileSegment(value: string): string {
  return (
    asText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "assets"
  );
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

function positiveRoundedValue(value: unknown): number | null {
  const numeric = numericValue(value);
  return numeric !== null && numeric > 0 ? Math.round(numeric) : null;
}

function currentValueExVat(item: AssetRegisterItem): number | null {
  return (
    positiveRoundedValue(item.selectedValueExVat) ??
    positiveRoundedValue(item.value)
  );
}

function replacementPriceExVat(item: AssetRegisterItem): number | null {
  const direct = positiveRoundedValue(item.replacementPriceExVat);
  if (direct !== null) return direct;

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  for (const key of REPLACEMENT_PRICE_SPEC_KEYS) {
    const value = positiveRoundedValue(specs[key]);
    if (value !== null) return value;
  }

  return null;
}

function insuredValueExVat(item: AssetRegisterItem): number | null {
  const direct = positiveRoundedValue(item.insuredValueExVat);
  if (direct !== null) return direct;

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  for (const key of INSURED_VALUE_SPEC_KEYS) {
    const value = positiveRoundedValue(specs[key]);
    if (value !== null) return value;
  }

  return null;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-ZA").format(Math.round(value));
}

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0)
    return "Not saved";
  return `R ${formatNumber(value)}`;
}

function normalizePhotoUrls(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? [value]
      : [];
  const seen = new Set<string>();
  const photos: string[] = [];

  for (const entry of values) {
    const url = asText(entry);
    const lowerUrl = url.toLowerCase();

    if (!url || seen.has(url)) {
      continue;
    }

    if (
      !lowerUrl.startsWith("data:image/") &&
      !lowerUrl.startsWith("https://") &&
      !lowerUrl.startsWith("http://") &&
      !lowerUrl.startsWith("/api/asset-register/uploads/")
    ) {
      continue;
    }

    seen.add(url);
    photos.push(url);
  }

  return photos;
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function buildRegisterLabel(
  register: AssetRegisterSummary,
  index: number,
): string {
  return asText(register.businessName) || `Asset Register #${index + 1}`;
}

function formatCondition(value: string): string {
  const normalized = asText(value).toLowerCase();

  return (
    {
      excellent: "Excellent",
      good: "Good",
      fair: "Fair",
      used: "Used",
      serious: "Requires attention",
    }[normalized] ??
    (asText(value) || "Not saved")
  );
}

function formatFuel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not saved";
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
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

function readFinanceStatusChoice(asset: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.financeStatus ??
      specs.finance_status ??
      specs.financedStatus ??
      specs.financed_status,
    asset.isFinanced ? "yes" : "no",
  );
}

function readInsuranceStatusChoice(
  asset: AssetRegisterItem,
): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.insuranceStatus ??
      specs.insurance_status ??
      specs.insuredStatus ??
      specs.insured_status,
    asset.isInsured ? "yes" : "no",
  );
}

function readLicenseStatusChoice(asset: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.licenseStatus ??
      specs.license_status ??
      specs.licensedStatus ??
      specs.licensed_status ??
      specs.licenceStatus ??
      specs.licence_status ??
      specs.licencedStatus ??
      specs.licenced_status,
    asset.isLicensed ? "yes" : "no",
  );
}

function formatAssetStatusChoice(value: AssetStatusChoice): string {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  if (value === "not_applicable") return "Not applicable";
  return "Not sure";
}

function readLicenseRegistrationNumber(asset: AssetRegisterItem): string {
  const direct = asText(asset.licenseRegistrationNumber).toUpperCase();
  if (direct) return direct;

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return asText(
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
      specs.numberplate,
  ).toUpperCase();
}

function getUsageUnit(asset: AssetRegisterItem): "hours" | "km" {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const rawUsage = String(
    specs.usageMetric ??
      specs.usage_metric ??
      specs.usageUnit ??
      specs.usage_unit ??
      specs.usageMetricType ??
      specs.usage_metric_type ??
      "",
  )
    .trim()
    .toLowerCase();

  if (asset.kind === "vehicle") return "km";
  if (
    rawUsage === "km" ||
    rawUsage === "kms" ||
    rawUsage === "kilometres" ||
    rawUsage === "kilometers"
  )
    return "km";
  return "hours";
}

function formatUsage(asset: AssetRegisterItem): string {
  if (typeof asset.hours === "number" && Number.isFinite(asset.hours)) {
    return `${formatNumber(asset.hours)} ${getUsageUnit(asset)}`;
  }

  if (
    typeof asset.lifeWorkedPercent === "number" &&
    Number.isFinite(asset.lifeWorkedPercent)
  ) {
    const percent = Math.max(
      0,
      Math.min(100, Math.round(asset.lifeWorkedPercent * 10) / 10),
    );
    return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}% worked`;
  }

  return "Not saved";
}

function assetTypeLabel(asset: AssetRegisterItem): string {
  const family = asText(asset.equipmentFamilyLabel);
  if (family) return family;

  const kind = asText(asset.kind);
  if (kind) return titleCase(kind);

  return "Asset";
}

function formatYearModel(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not saved";
  return String(Math.round(value));
}

function hasCoordinates(asset: AssetRegisterItem): boolean {
  const { lastKnownLat: lat, lastKnownLng: lng } = asset;
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function sortSourcedAssets(left: SourcedAsset, right: SourcedAsset): number {
  const leftTime = left.item.lastScannedAtIso
    ? new Date(left.item.lastScannedAtIso).getTime()
    : 0;
  const rightTime = right.item.lastScannedAtIso
    ? new Date(right.item.lastScannedAtIso).getTime()
    : 0;

  if (rightTime !== leftTime) {
    return rightTime - leftTime;
  }

  const registerComparison = left.registerName.localeCompare(
    right.registerName,
    "en",
    { sensitivity: "base" },
  );
  if (registerComparison !== 0) return registerComparison;
  return left.item.title.localeCompare(right.item.title, "en", {
    sensitivity: "base",
  });
}

function normalizeLookupKey(value: string): string {
  return asText(value).toLowerCase();
}

function appendUnique(target: string[], value: string | null): void {
  const normalized = asText(value);
  if (!normalized) return;

  if (
    !target.some(
      (existing) =>
        normalizeLookupKey(existing) === normalizeLookupKey(normalized),
    )
  ) {
    target.push(normalized);
  }
}

function splitListParam(value: string | null): string[] {
  return asText(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function readAssetReportSelection(url: URL): AssetReportSelection {
  const codes: string[] = [];
  const ids: string[] = [];

  splitListParam(url.searchParams.get("codes")).forEach((code) =>
    appendUnique(codes, code),
  );
  appendUnique(codes, url.searchParams.get("assetCode"));
  appendUnique(codes, url.searchParams.get("publicAssetCode"));
  appendUnique(codes, url.searchParams.get("code"));

  splitListParam(url.searchParams.get("ids")).forEach((id) =>
    appendUnique(ids, id),
  );
  appendUnique(ids, url.searchParams.get("assetId"));
  appendUnique(ids, url.searchParams.get("id"));

  return { codes, ids };
}

function filterSourcesBySelection(
  assets: SourcedAsset[],
  selection: AssetReportSelection,
): SourcedAsset[] {
  const sortedAssets = [...assets].sort(sortSourcedAssets);

  if (!selection.codes.length && !selection.ids.length) {
    return sortedAssets;
  }

  const byCode = new Map(
    sortedAssets.map((asset) => [
      normalizeLookupKey(asset.item.publicAssetCode),
      asset,
    ]),
  );
  const byId = new Map(
    sortedAssets.map((asset) => [normalizeLookupKey(asset.item.id), asset]),
  );
  const selected: SourcedAsset[] = [];
  const seenIds = new Set<string>();

  const addAsset = (asset: SourcedAsset | undefined) => {
    if (!asset || seenIds.has(asset.item.id)) return;
    selected.push(asset);
    seenIds.add(asset.item.id);
  };

  selection.codes.forEach((code) =>
    addAsset(byCode.get(normalizeLookupKey(code))),
  );
  selection.ids.forEach((id) => addAsset(byId.get(normalizeLookupKey(id))));

  return selected;
}

async function loadScopedMappedAssets(
  userId: string,
  url: URL,
): Promise<ScopedAssetResult> {
  const registers = await listAssetRegisters(userId);
  const registerContexts: AssetMapRegisterContext[] = registers.map(
    (register, index) => ({
      id: register.id,
      label: buildRegisterLabel(register, index),
      index,
    }),
  );
  const selection = readAssetReportSelection(url);
  const selectedAssetMode =
    selection.codes.length > 0 || selection.ids.length > 0;
  const requestedRegisterId = asText(url.searchParams.get("registerId"));
  const registerIdParam = requestedRegisterId.toLowerCase();

  let selectedRegisters = registerContexts;
  let scopeLabel = "All Assets";
  let scopeSegment = "all-assets";

  if (!selectedAssetMode && requestedRegisterId && registerIdParam !== "all") {
    const register = registerContexts.find(
      (candidate) => candidate.id === requestedRegisterId,
    );

    if (!register) {
      throw new Error("ASSET_MAP_REGISTER_NOT_FOUND");
    }

    selectedRegisters = [register];
    scopeLabel = register.label;
    scopeSegment = formatFileSegment(
      register.label || `asset-register-${register.index + 1}`,
    );
  }

  const registerBundles = await Promise.all(
    selectedRegisters.map(async (register) => ({
      register,
      items: await listAssetRegisterItems(userId, register.id),
    })),
  );

  const sourcedAssets = registerBundles.flatMap(({ register, items }) =>
    items.map((item) => ({
      item,
      registerId: register.id,
      registerName: register.label,
      registerIndex: register.index,
    })),
  );
  const mappedAssets = sourcedAssets.filter(({ item }) => hasCoordinates(item));
  const scopedAssets = selectedAssetMode
    ? filterSourcesBySelection(mappedAssets, selection)
    : [...mappedAssets].sort(sortSourcedAssets);

  if (selectedAssetMode) {
    scopeLabel =
      scopedAssets.length === 1
        ? scopedAssets[0].item.title || "Selected asset"
        : "Selected Assets";
    scopeSegment =
      scopedAssets.length === 1
        ? formatFileSegment(
            `${scopedAssets[0].item.title}-${scopedAssets[0].item.publicAssetCode}`,
          )
        : "selected-assets";
  }

  return {
    assets: scopedAssets,
    scopeLabel,
    scopeSegment,
    selectedAssetMode,
  };
}

function toPrintableAsset(source: SourcedAsset, index: number): PrintableAsset {
  const item = source.item;
  const latitude =
    typeof item.lastKnownLat === "number"
      ? item.lastKnownLat
      : Number(item.lastKnownLat);
  const longitude =
    typeof item.lastKnownLng === "number"
      ? item.lastKnownLng
      : Number(item.lastKnownLng);
  const currentRaw = currentValueExVat(item);
  const replacementRaw = replacementPriceExVat(item);
  const insuredRaw = insuredValueExVat(item);
  const licenseStatus = readLicenseStatusChoice(item);
  const latLngText = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  return {
    number: index + 1,
    title: item.title || "Saved asset",
    plateLabel: item.plateLabel || item.publicAssetCode || "No plate label",
    publicAssetCode: item.publicAssetCode,
    serialNumber: item.serialNumber || "Not saved",
    assetTypeLabel: assetTypeLabel(item),
    registerId: source.registerId,
    registerName: source.registerName,
    yearModel: formatYearModel(item.yearModel),
    currentValueRaw: currentRaw,
    currentValue: formatMoney(currentRaw),
    replacementValueRaw: replacementRaw,
    replacementValue: formatMoney(replacementRaw),
    insuredValueRaw: insuredRaw,
    insuredValue: formatMoney(insuredRaw),
    fuel: formatFuel(item.fuelPercent),
    financed: formatAssetStatusChoice(readFinanceStatusChoice(item)),
    insured: formatAssetStatusChoice(readInsuranceStatusChoice(item)),
    licensed: formatAssetStatusChoice(licenseStatus),
    licenseRegistrationNumber:
      licenseStatus === "yes" ? readLicenseRegistrationNumber(item) : "",
    usage: formatUsage(item),
    condition: formatCondition(item.condition),
    lastScanned: formatDateTime(item.lastScannedAtIso),
    locationText:
      item.lastKnownLocationText || "No written location note saved",
    photoUrls: normalizePhotoUrls(item.photos),
    latitude,
    longitude,
    latLngText,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  };
}

function sumAssetValues(
  assets: PrintableAsset[],
  selector: (asset: PrintableAsset) => number | null,
): number {
  return assets.reduce(
    (sum, asset) => sum + Math.round(selector(asset) ?? 0),
    0,
  );
}

function buildReportFilename(
  assets: PrintableAsset[],
  scopeSegment: string,
  generatedAt = new Date(),
): string {
  const dateSegment = formatFileDate(generatedAt);

  if (assets.length === 1) {
    const asset = assets[0];
    const assetSegment = formatFileSegment(
      `${asset.title}-${asset.publicAssetCode}`,
    );
    return `aim4price-asset-map-tracking-${assetSegment}-${dateSegment}.html`;
  }

  return `aim4price-asset-map-tracking-${formatFileSegment(scopeSegment || "all-assets")}-${dateSegment}.html`;
}

function buildXlsxFilename(
  scopeSegment: string,
  generatedAt = new Date(),
): string {
  return `aim4price-asset-map-tracking-${formatFileSegment(scopeSegment || "all-assets")}-${formatFileDate(generatedAt)}.xlsx`;
}

function textCell(value: string, style: XlsxCellStyle = "text"): XlsxCellValue {
  return { value, style };
}

function numberCell(
  value: number | null,
  style: XlsxCellStyle = "integer",
): XlsxCellValue {
  return value === null ? textCell("Not saved", "muted") : { value, style };
}

function buildAssetGpsWorkbook(
  assets: PrintableAsset[],
  scopeLabel: string,
  generatedAt: Date,
): Buffer {
  const headers = [
    "Asset #",
    "Asset title",
    "Asset register",
    "Asset type",
    "Serial / VIN",
    "Year",
    "Condition",
    "Value ex VAT",
    "Replacement price ex VAT",
    "Insured price ex VAT",
    "Last scanned",
    "Latitude",
    "Longitude",
    "Last GPS coordinate",
    "Location note",
    "Google Maps",
  ];

  const rows: XlsxCellValue[][] = [
    [textCell("Asset Map Tracking GPS Export", "title")],
    [textCell("Scope", "metaLabel"), textCell(scopeLabel, "metaValue")],
    [
      textCell("Generated", "metaLabel"),
      textCell(
        `${formatDate(generatedAt)} ${formatTime(generatedAt)}`,
        "metaValue",
      ),
    ],
    [textCell("Mapped GPS assets", "metaLabel"), numberCell(assets.length)],
    [],
    headers.map((header) => textCell(header, "tableHeader")),
    ...assets.map((asset) => [
      numberCell(asset.number),
      textCell(asset.title),
      textCell(asset.registerName),
      textCell(asset.assetTypeLabel),
      textCell(asset.serialNumber),
      textCell(asset.yearModel),
      textCell(asset.condition),
      numberCell(asset.currentValueRaw, "currency"),
      numberCell(asset.replacementValueRaw, "currency"),
      numberCell(asset.insuredValueRaw, "currency"),
      textCell(asset.lastScanned),
      numberCell(asset.latitude, "decimal"),
      numberCell(asset.longitude, "decimal"),
      textCell(asset.latLngText),
      textCell(asset.locationText),
      textCell(asset.googleMapsUrl),
    ]),
  ];

  const sheet: XlsxSheet = {
    name: "Asset GPS",
    rows,
    columns: [10, 34, 28, 20, 20, 14, 18, 18, 24, 22, 26, 14, 14, 22, 34, 48],
    merges: [
      { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: headers.length },
      { fromRow: 2, fromColumn: 2, toRow: 2, toColumn: headers.length },
      { fromRow: 3, fromColumn: 2, toRow: 3, toColumn: headers.length },
    ],
    freezeRow: 6,
    autoFilter: {
      fromRow: 6,
      fromColumn: 1,
      toRow: Math.max(6, rows.length),
      toColumn: headers.length,
    },
    tabColor: "197454",
  };

  return createXlsxWorkbook([sheet]);
}

function renderKeyRows(assets: PrintableAsset[]): string {
  if (!assets.length) {
    return `
      <div class="assetMapReportEmpty">
        <strong>No mapped GPS assets in this report.</strong>
        <span>Go back to Asset Map Tracking and choose a scope with saved GPS coordinates.</span>
      </div>
    `;
  }

  return assets
    .map(
      (asset) => `
        <article class="assetMapReportKeyRow">
          <div class="assetMapReportMarkerNumber">${asset.number}</div>
          <div class="assetMapReportAssetCell">
            <strong>${escapeHtml(asset.title)}</strong>
            <span>${escapeHtml(asset.assetTypeLabel)} · ${escapeHtml(asset.registerName)}</span>
          </div>
          <div class="assetMapReportCell">
            <span>Current value</span>
            <strong>${escapeHtml(asset.currentValue)}</strong>
          </div>
          <div class="assetMapReportCell">
            <span>Replacement</span>
            <strong>${escapeHtml(asset.replacementValue)}</strong>
          </div>
          <div class="assetMapReportCell">
            <span>Insured</span>
            <strong>${escapeHtml(asset.insuredValue)}</strong>
          </div>
          <div class="assetMapReportCell">
            <span>Serial / VIN</span>
            <strong>${escapeHtml(asset.serialNumber)}</strong>
          </div>
          <div class="assetMapReportCell">
            <span>Year / condition</span>
            <strong>${escapeHtml(asset.yearModel)} · ${escapeHtml(asset.condition)}</strong>
          </div>
          <div class="assetMapReportCell assetMapReportGpsCell">
            <span>Last GPS coordinate</span>
            <strong>${escapeHtml(asset.latLngText)}</strong>
          </div>
          <div class="assetMapReportCell assetMapReportLastScannedCell">
            <span>Last scanned</span>
            <strong>${escapeHtml(asset.lastScanned)}</strong>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderSelectedAssetRows(asset: PrintableAsset): string {
  const rows: Array<[string, string]> = [
    ["Asset register", asset.registerName],
    ["Asset type", asset.assetTypeLabel],
    ["Plate label", asset.plateLabel],
    ["Serial / VIN", asset.serialNumber],
    ["Year model", asset.yearModel],
    ["Condition", asset.condition],
    ["Usage", asset.usage],
    ["Fuel", asset.fuel],
    ["Current value ex VAT", asset.currentValue],
    ["Replacement price ex VAT", asset.replacementValue],
    ["Insured price ex VAT", asset.insuredValue],
    ["Financed", asset.financed],
    ["Insured", asset.insured],
    ["Licensed", asset.licensed],
    ...(asset.licenseRegistrationNumber
      ? [["Registration", asset.licenseRegistrationNumber] as [string, string]]
      : []),
    ["Last GPS coordinate", asset.latLngText],
    ["Location note", asset.locationText],
    ["Last scanned", asset.lastScanned],
  ];

  return rows
    .map(
      ([label, value]) => `
        <div class="assetMapReportDetailRow">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderAssetPhotoSection(asset: PrintableAsset | null): string {
  if (!asset?.photoUrls.length) {
    return "";
  }

  const maxReportPhotos = 12;
  const photos = asset.photoUrls.slice(0, maxReportPhotos);
  const extraPhotoCount = Math.max(0, asset.photoUrls.length - photos.length);
  const gridClass = `assetMapReportPhotoGrid assetMapReportPhotoGridCount${Math.min(photos.length, 4)}`;

  return `
    <section class="assetMapReportSection assetMapReportPhotoSection">
      <div class="assetMapReportSectionTitleRow">
        <h2>Asset Photos</h2>
        <span>${photos.length} photo${photos.length === 1 ? "" : "s"} shown</span>
      </div>
      <div class="${gridClass}">
        ${photos
          .map(
            (photoUrl, index) => `
              <figure class="assetMapReportPhotoTile">
                <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(`${asset.title} photo ${index + 1}`)}" />
                <figcaption>Photo ${index + 1}</figcaption>
              </figure>
            `,
          )
          .join("")}
      </div>
      ${
        extraPhotoCount
          ? `<p class="assetMapReportPhotoNote">${extraPhotoCount} additional photo${extraPhotoCount === 1 ? "" : "s"} saved in the asset register.</p>`
          : ""
      }
    </section>
  `;
}

function buildReportHtml(
  assets: PrintableAsset[],
  options: {
    generatedDate: string;
    generatedTime: string;
    ownerEmail: string;
    logoUrl: string;
    scopeLabel: string;
  },
): string {
  const singleAsset = assets.length === 1 ? assets[0] : null;
  const documentTitle = "Asset Map Tracking Report";
  const heroTitle = singleAsset ? singleAsset.title : options.scopeLabel;
  const heroBadge = singleAsset
    ? singleAsset.assetTypeLabel
    : "Asset Map Tracking";
  const heroMeta = singleAsset
    ? `${singleAsset.registerName} · ${singleAsset.plateLabel} · Last GPS coordinate ${singleAsset.latLngText}`
    : `${assets.length} mapped GPS assets shown and numbered. Markers match the location key below.`;
  const currentValueTotal = sumAssetValues(
    assets,
    (asset) => asset.currentValueRaw,
  );
  const replacementValueTotal = sumAssetValues(
    assets,
    (asset) => asset.replacementValueRaw,
  );
  const insuredValueTotal = sumAssetValues(
    assets,
    (asset) => asset.insuredValueRaw,
  );
  const mapData = safeScriptJson(
    assets.map((asset) => ({
      number: asset.number,
      title: asset.title,
      plateLabel: asset.plateLabel,
      registerName: asset.registerName,
      latitude: asset.latitude,
      longitude: asset.longitude,
      latLngText: asset.latLngText,
    })),
  );
  const rowsHtml = renderKeyRows(assets);
  const selectedAssetRows = singleAsset
    ? renderSelectedAssetRows(singleAsset)
    : "";
  const photoSectionHtml = renderAssetPhotoSection(singleAsset);
  const sideMapHtml = singleAsset
    ? '<section class="assetMapReportSideCard"><h2>Overview Map</h2><div id="overviewMap" aria-label="Selected asset overview map"></div></section>'
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(singleAsset ? `${singleAsset.title} - Aim4price Asset Map Tracking` : "Aim4price Asset Map Tracking Report")}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --strong: #070b12;
        --muted: #5f6b7a;
        --faint: #8b95a3;
        --paper: #ffffff;
        --soft: #f5f6f8;
        --soft-2: #fafbfc;
        --line: #d7dde5;
        --line-strong: #b9c2ce;
        --brand: #103f35;
        --brand-soft: #eaf5ef;
      }

      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @page {
        size: A4 landscape;
        margin: 8mm 9mm 8mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #eef1f4;
        color: var(--ink);
        font-family: "Montserrat", "Segoe UI", Arial, Helvetica, sans-serif;
        font-size: 9.5px;
        line-height: 1.35;
      }

      .assetMapReportScreenBar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px 16px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.96);
        border-bottom: 1px solid #d7dce2;
        box-shadow: 0 10px 26px rgba(17, 24, 39, 0.07);
      }

      .assetMapReportScreenText {
        min-width: 0;
        color: var(--muted);
        font-size: 12.5px;
        line-height: 1.4;
      }

      .assetMapReportScreenActions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: nowrap;
      }

      .assetMapReportButton {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        min-height: 42px;
        padding: 0 16px;
        border: 1px solid #cfd5dd;
        border-radius: 999px;
        background: #ffffff;
        color: var(--ink);
        font: inherit;
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
      }

      .assetMapReportButtonPrimary {
        min-width: 150px;
        border-color: var(--brand);
        background: var(--brand);
        color: #ffffff;
        box-shadow: 0 12px 22px rgba(16, 63, 53, 0.18);
      }

      .assetMapReportPage {
        width: min(100%, 297mm);
        min-height: 210mm;
        margin: 18px auto;
        padding: 9mm 10mm 8mm;
        background: var(--paper);
        box-shadow: 0 16px 44px rgba(17, 24, 39, 0.13);
      }

      .assetMapReportInner {
        display: grid;
        min-height: calc(210mm - 17mm);
        gap: 8px;
      }

      .assetMapReportHeader {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr) 74mm;
        gap: 12px;
        align-items: center;
        padding-bottom: 9px;
        border-bottom: 1px solid var(--line-strong);
      }

      .assetMapReportLogoWrap {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        min-height: 17mm;
      }

      .assetMapReportLogo {
        display: block;
        width: 18mm;
        height: auto;
        max-height: 18mm;
        object-fit: contain;
      }

      .assetMapReportDocumentTitle strong {
        display: block;
        color: var(--strong);
        font-size: 16px;
        line-height: 1.05;
        font-weight: 700;
        letter-spacing: -0.025em;
      }

      .assetMapReportDocumentTitle span {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 8.9px;
        font-weight: 600;
      }

      .assetMapReportHeaderMeta {
        display: grid;
        gap: 4px;
        color: var(--muted);
        font-size: 8.3px;
      }

      .assetMapReportMetaLine {
        display: grid;
        grid-template-columns: 23mm minmax(0, 1fr);
        gap: 7px;
        align-items: baseline;
      }

      .assetMapReportMetaLine span {
        color: var(--muted);
        font-weight: 600;
      }

      .assetMapReportMetaLine strong {
        color: var(--strong);
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetMapReportOverview {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 92mm;
        align-items: stretch;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetMapReportIdentity {
        min-width: 0;
        padding: 10px 13px 11px;
      }

      .assetMapReportKicker {
        margin: 0 0 6px;
        color: var(--muted);
        font-size: 8.1px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .assetMapReportTitle {
        margin: 0;
        color: var(--strong);
        font-size: 21px;
        line-height: 1.08;
        font-weight: 700;
        letter-spacing: -0.035em;
      }

      .assetMapReportHeroMeta {
        margin: 7px 0 0;
        color: #3f4652;
        font-size: 9.2px;
        line-height: 1.35;
        font-weight: 600;
      }

      .assetMapReportSummaryCard {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
        padding: 9px 10px;
        border-left: 1px solid var(--line-strong);
        background: var(--soft-2);
      }

      .assetMapReportSummaryMetric {
        min-width: 0;
        display: grid;
        gap: 2px;
        padding: 6px 7px;
        border: 1px solid var(--line);
        background: #ffffff;
      }

      .assetMapReportSummaryMetric span {
        color: var(--muted);
        font-size: 7.5px;
        line-height: 1.2;
        font-weight: 600;
      }

      .assetMapReportSummaryMetric strong {
        color: var(--strong);
        font-size: 11px;
        line-height: 1.1;
        font-weight: 700;
        word-break: break-word;
      }

      .assetMapReportContentGrid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) ${singleAsset ? "76mm" : "0"};
        gap: ${singleAsset ? "12px" : "0"};
        align-items: stretch;
      }

      .assetMapReportMapSection,
      .assetMapReportSection,
      .assetMapReportSideCard {
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetMapReportMapSection {
        min-width: 0;
        display: grid;
        grid-template-rows: auto 1fr;
        overflow: hidden;
      }

      .assetMapReportSectionHeader {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 10px 7px;
        border-bottom: 1px solid var(--line);
      }

      .assetMapReportSectionHeader h2 {
        margin: 0;
        color: var(--strong);
        font-size: 10.8px;
        line-height: 1.1;
        font-weight: 700;
      }

      .assetMapReportSectionHeader span {
        color: var(--muted);
        font-size: 8px;
        line-height: 1.2;
        font-weight: 600;
        text-align: right;
      }

      #map {
        width: 100%;
        height: ${singleAsset ? "92mm" : "94mm"};
        min-height: ${singleAsset ? "92mm" : "94mm"};
        background: #dfe8e2;
      }

      #overviewMap {
        width: 100%;
        height: 38mm;
        min-height: 38mm;
        border: 1px solid var(--line);
        background: #dfe8e2;
      }

      .assetMapReportSide {
        display: ${singleAsset ? "grid" : "none"};
        gap: 8px;
      }

      .assetMapReportSideCard {
        padding: 10px 10px 9px;
      }

      .assetMapReportSideCard h2,
      .assetMapReportSection h2 {
        margin: 0 0 8px;
        color: var(--strong);
        font-size: 10.8px;
        line-height: 1.1;
        font-weight: 700;
      }

      .assetMapReportDetailRows {
        width: 100%;
        border-top: 1px solid var(--line);
      }

      .assetMapReportDetailRow {
        display: grid;
        grid-template-columns: 27mm minmax(0, 1fr);
        min-height: 17px;
        align-items: center;
        border-bottom: 1px solid var(--line);
      }

      .assetMapReportDetailRow span {
        color: #38404c;
        font-size: 7.8px;
        line-height: 1.3;
        font-weight: 600;
      }

      .assetMapReportDetailRow strong {
        color: var(--strong);
        font-size: 7.8px;
        line-height: 1.3;
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetMapReportSection {
        display: grid;
        gap: 9px;
        padding: 10px 11px 12px;
        break-inside: avoid;
      }

      .assetMapReportKeyRows {
        display: grid;
        gap: 6px;
        border-top: 0;
      }

      .assetMapReportKeyRow {
        display: grid;
        grid-template-columns: 9mm minmax(35mm, 1.1fr) minmax(22mm, 0.58fr) minmax(23mm, 0.58fr) minmax(22mm, 0.54fr) minmax(25mm, 0.62fr) minmax(28mm, 0.68fr) minmax(34mm, 0.78fr) minmax(30mm, 0.7fr);
        gap: 6px;
        min-height: 34px;
        align-items: center;
        padding: 7px 8px;
        border: 1px solid var(--line);
        background: var(--soft-2);
        break-inside: avoid;
      }

      .assetMapReportMarkerNumber {
        display: grid;
        place-items: center;
        width: 23px;
        height: 23px;
        border-radius: 999px;
        color: #ffffff;
        background: var(--brand);
        font-size: 8.5px;
        font-weight: 800;
      }

      .assetMapReportAssetCell,
      .assetMapReportCell {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .assetMapReportAssetCell strong,
      .assetMapReportCell strong {
        min-width: 0;
        overflow-wrap: anywhere;
        color: var(--strong);
        font-size: 8px;
        line-height: 1.25;
        font-weight: 700;
      }

      .assetMapReportAssetCell span,
      .assetMapReportCell span {
        min-width: 0;
        overflow-wrap: anywhere;
        color: #38404c;
        font-size: 7.4px;
        line-height: 1.25;
        font-weight: 600;
      }

      .assetMapReportGpsCell strong {
        font-size: 7.6px;
      }

      .assetMapReportLastScannedCell strong {
        font-size: 7.2px;
        line-height: 1.18;
      }

      .assetMapReportSectionTitleRow {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }

      .assetMapReportSectionTitleRow h2 {
        margin: 0;
      }

      .assetMapReportSectionTitleRow span {
        color: var(--muted);
        font-size: 8px;
        line-height: 1.2;
        font-weight: 600;
        text-align: right;
      }

      .assetMapReportPhotoSection {
        break-inside: avoid;
      }

      .assetMapReportPhotoGrid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .assetMapReportPhotoGridCount1 {
        grid-template-columns: minmax(0, 96mm);
      }

      .assetMapReportPhotoGridCount2 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        max-width: 190mm;
      }

      .assetMapReportPhotoGridCount3 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .assetMapReportPhotoTile {
        min-width: 0;
        margin: 0;
        border: 1px solid var(--line);
        background: var(--soft-2);
        break-inside: avoid;
      }

      .assetMapReportPhotoTile img {
        display: block;
        width: 100%;
        height: 34mm;
        object-fit: contain;
        background: #f1f4f7;
      }

      .assetMapReportPhotoGridCount1 .assetMapReportPhotoTile img {
        height: 62mm;
      }

      .assetMapReportPhotoGridCount2 .assetMapReportPhotoTile img {
        height: 50mm;
      }

      .assetMapReportPhotoGridCount3 .assetMapReportPhotoTile img {
        height: 40mm;
      }

      .assetMapReportPhotoTile figcaption {
        padding: 4px 7px 5px;
        border-top: 1px solid var(--line);
        color: #3f4652;
        font-size: 7.5px;
        font-weight: 600;
      }

      .assetMapReportPhotoNote {
        margin: -2px 0 0;
        color: var(--muted);
        font-size: 7.8px;
        font-weight: 600;
      }

      .assetMapReportEmpty {
        display: grid;
        place-items: center;
        gap: 5px;
        min-height: 35mm;
        text-align: center;
        color: var(--muted);
        font-size: 9px;
      }

      .assetMapReportEmpty strong {
        color: var(--strong);
      }

      .assetMapReportFooter {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: end;
        padding-top: 8px;
        border-top: 1px solid var(--line-strong);
      }

      .assetMapReportPowered {
        margin: 0 0 4px;
        color: var(--strong);
        font-size: 8.2px;
        font-weight: 700;
      }

      .assetMapReportDisclaimer {
        max-width: 190mm;
        color: #323a45;
        font-size: 7.35px;
        line-height: 1.35;
        font-style: italic;
      }

      .assetMapReportPageNumber {
        color: var(--strong);
        font-size: 8px;
        font-weight: 700;
        white-space: nowrap;
      }

      .leaflet-container {
        font-family: inherit;
      }

      .leaflet-control-attribution {
        font-size: 7px;
      }

      .reportMarker {
        background: transparent;
        border: 0;
      }

      .reportMarkerPin {
        position: relative;
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        color: #ffffff;
        background: var(--brand);
        border: 3px solid #ffffff;
        box-shadow: 0 9px 18px rgba(16, 63, 53, 0.3);
      }

      .reportMarkerPin::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -5px;
        width: 9px;
        height: 9px;
        border-right: 3px solid #ffffff;
        border-bottom: 3px solid #ffffff;
        background: var(--brand);
        transform: translateX(-50%) rotate(45deg);
        border-radius: 0 0 3px 0;
      }

      .reportMarkerPin b {
        position: relative;
        z-index: 2;
        font-size: 8.4px;
        font-weight: 800;
      }

      @media screen and (max-width: 900px) {
        .assetMapReportPage {
          width: min(100% - 24px, 297mm);
        }

        .assetMapReportScreenBar {
          grid-template-columns: 1fr;
          padding: 10px 12px 12px;
        }

        .assetMapReportScreenText {
          font-size: 12px;
        }

        .assetMapReportScreenActions {
          display: grid;
          grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr);
          width: 100%;
          gap: 8px;
        }

        .assetMapReportButton {
          width: 100%;
          min-height: 44px;
          padding: 0 10px;
          font-size: 12px;
        }

        .assetMapReportButtonPrimary {
          min-width: 0;
        }

        .assetMapReportHeader,
        .assetMapReportOverview,
        .assetMapReportContentGrid {
          grid-template-columns: 1fr;
        }

        .assetMapReportSummaryCard {
          border-left: 0;
          border-top: 1px solid var(--line-strong);
        }

        .assetMapReportHeaderMeta,
        .assetMapReportMetaLine strong,
        .assetMapReportDetailRow strong {
          text-align: left;
        }
      }

      @media screen and (max-width: 380px) {
        .assetMapReportScreenActions {
          grid-template-columns: 1fr;
        }
      }

      @media print {
        html,
        body {
          background: #ffffff;
        }

        .assetMapReportScreenBar {
          display: none !important;
        }

        .assetMapReportPage {
          width: auto;
          min-height: 0;
          margin: 0;
          padding: 0;
          box-shadow: none;
        }

        .assetMapReportInner {
          min-height: 0;
          gap: 7px;
        }

        .assetMapReportHeader {
          grid-template-columns: 22mm minmax(0, 1fr) 74mm;
        }

        .assetMapReportOverview {
          grid-template-columns: minmax(0, 1fr) 92mm;
        }

        .assetMapReportContentGrid {
          grid-template-columns: minmax(0, 1fr) ${singleAsset ? "76mm" : "0"};
          gap: ${singleAsset ? "12px" : "0"};
        }

        #map {
          height: ${singleAsset ? "93mm" : "96mm"};
          min-height: ${singleAsset ? "93mm" : "96mm"};
        }

        .assetMapReportSection {
          gap: 6px;
          padding: 8px 9px 9px;
        }

        .assetMapReportKeyRows {
          gap: 5px;
        }

        .assetMapReportKeyRow {
          min-height: 31px;
          padding: 6px 8px;
        }

        .assetMapReportPhotoGrid {
          gap: 6px;
        }

        .assetMapReportPhotoTile img {
          height: 32mm;
        }

        .assetMapReportPhotoGridCount1 .assetMapReportPhotoTile img {
          height: 58mm;
        }

        .assetMapReportPhotoGridCount2 .assetMapReportPhotoTile img {
          height: 47mm;
        }

        .assetMapReportPhotoGridCount3 .assetMapReportPhotoTile img {
          height: 38mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="assetMapReportScreenBar">
      <div class="assetMapReportScreenText">Save or print this Asset Map Tracking report. In the print dialog, choose <strong>Save as PDF</strong>.</div>
      <div class="assetMapReportScreenActions">
        <button type="button" class="assetMapReportButton" onclick="window.close()">Close</button>
        <button type="button" class="assetMapReportButton assetMapReportButtonPrimary" onclick="window.print()">Save PDF / Print</button>
      </div>
    </div>

    <main class="assetMapReportPage">
      <div class="assetMapReportInner">
        <header class="assetMapReportHeader">
          <div class="assetMapReportLogoWrap">${options.logoUrl ? `<img class="assetMapReportLogo" src="${escapeHtml(options.logoUrl)}" alt="Logo" />` : ""}</div>
          <div class="assetMapReportDocumentTitle">
            <strong>${escapeHtml(documentTitle)}</strong>
            <span>Aim4price saved GPS location report</span>
          </div>
          <div class="assetMapReportHeaderMeta">
            <div class="assetMapReportMetaLine"><span>Generated</span><strong>${escapeHtml(options.generatedDate)}</strong></div>
            <div class="assetMapReportMetaLine"><span>Time</span><strong>${escapeHtml(options.generatedTime)}</strong></div>
            <div class="assetMapReportMetaLine"><span>Scope</span><strong>${escapeHtml(options.scopeLabel)}</strong></div>
            ${options.ownerEmail ? `<div class="assetMapReportMetaLine"><span>Email</span><strong>${escapeHtml(options.ownerEmail)}</strong></div>` : ""}
          </div>
        </header>

        <section class="assetMapReportOverview">
          <div class="assetMapReportIdentity">
            <p class="assetMapReportKicker">${escapeHtml(heroBadge)}</p>
            <h1 class="assetMapReportTitle">${escapeHtml(heroTitle)}</h1>
            <p class="assetMapReportHeroMeta">${escapeHtml(heroMeta)}</p>
          </div>

          <aside class="assetMapReportSummaryCard" aria-label="Asset Map Tracking summary">
            <div class="assetMapReportSummaryMetric"><span>Mapped assets</span><strong>${assets.length}</strong></div>
            <div class="assetMapReportSummaryMetric"><span>Current value</span><strong>${escapeHtml(formatMoney(currentValueTotal))}</strong></div>
            <div class="assetMapReportSummaryMetric"><span>Replacement price</span><strong>${escapeHtml(formatMoney(replacementValueTotal))}</strong></div>
            <div class="assetMapReportSummaryMetric"><span>Insured price</span><strong>${escapeHtml(formatMoney(insuredValueTotal))}</strong></div>
          </aside>
        </section>

        <div class="assetMapReportContentGrid">
          <section class="assetMapReportMapSection">
            <div class="assetMapReportSectionHeader">
              <h2>${singleAsset ? "Close-up Asset Map" : "Asset Location Map"}</h2>
              <span>${assets.length === 1 ? "Close-up GPS marker shown" : "Markers are numbered to match the location key"}</span>
            </div>
            <div id="map" aria-label="Asset map tracking report map"></div>
          </section>

          <aside class="assetMapReportSide">
            ${sideMapHtml}
            <section class="assetMapReportSideCard">
              <h2>Selected Asset Details</h2>
              <div class="assetMapReportDetailRows">${selectedAssetRows}</div>
            </section>
          </aside>
        </div>

        <section class="assetMapReportSection">
          <h2>Location Key</h2>
          <div class="assetMapReportKeyRows">${rowsHtml}</div>
        </section>

        ${photoSectionHtml}

        <footer class="assetMapReportFooter">
          <div>
            <p class="assetMapReportPowered">Powered by Aim4price.com</p>
            <div class="assetMapReportDisclaimer">This report reflects the latest saved GPS position for each mapped asset at the time it was generated. Use the coordinates and marker numbers as a location aid, not as a legal survey record.</div>
          </div>
          <div class="assetMapReportPageNumber">Page 1</div>
        </footer>
      </div>
    </main>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      (function () {
        var assets = ${mapData};
        var defaultCenter = [${DEFAULT_CENTER[0]}, ${DEFAULT_CENTER[1]}];

        function addHybridLayers(map) {
          var imagery = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri',
          }).addTo(map);
          var labels = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Labels &copy; Esri',
          }).addTo(map);
          return { primary: imagery, labels: labels };
        }

        function addRoadLayer(map) {
          return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map);
        }

        function buildStaticMap(mapEl) {
          return L.map(mapEl, {
            zoomControl: false,
            attributionControl: true,
            scrollWheelZoom: false,
            dragging: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            tap: false,
          });
        }

        function escapePopup(value) {
          return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        function markerIcon(asset) {
          return L.divIcon({
            className: 'reportMarker',
            html: '<span class="reportMarkerPin"><b>' + asset.number + '</b></span>',
            iconSize: [34, 40],
            iconAnchor: [17, 36],
            popupAnchor: [0, -31],
          });
        }

        function addMarkers(map, markerAssets) {
          var bounds = [];

          markerAssets.forEach(function (asset) {
            var marker = L.marker([asset.latitude, asset.longitude], { icon: markerIcon(asset) }).addTo(map);
            marker.bindPopup('<strong>' + escapePopup(asset.title) + '</strong><br />' + escapePopup(asset.registerName) + '<br />GPS ' + escapePopup(asset.latLngText));
            bounds.push([asset.latitude, asset.longitude]);
          });

          return bounds;
        }

        function initOverviewMap(asset) {
          var overviewEl = document.getElementById('overviewMap');
          if (!overviewEl || !asset) return null;

          var overviewMap = buildStaticMap(overviewEl);
          var overviewTiles = addRoadLayer(overviewMap);
          L.marker([asset.latitude, asset.longitude], { icon: markerIcon(asset) }).addTo(overviewMap);
          overviewMap.setView([asset.latitude, asset.longitude], 13);
          return overviewTiles;
        }

        function initMap() {
          var mapEl = document.getElementById('map');
          if (!mapEl || !window.L) {
            return;
          }

          var map = buildStaticMap(mapEl);
          var layers = addHybridLayers(map);

          if (!assets.length) {
            map.setView(defaultCenter, 5);
            schedulePrint(layers.primary);
            return;
          }

          var bounds = addMarkers(map, assets);

          if (bounds.length === 1) {
            map.setView(bounds[0], 17);
            initOverviewMap(assets[0]);
          } else {
            map.fitBounds(bounds, { padding: [44, 44], maxZoom: 14 });
          }

          schedulePrint(layers.primary);
        }

        function waitForFonts() {
          if (document.fonts && document.fonts.ready) {
            return Promise.race([
              document.fonts.ready.catch(function () { return undefined; }),
              new Promise(function (resolve) { window.setTimeout(resolve, 900); }),
            ]);
          }

          return Promise.resolve();
        }

        function waitForImages() {
          var images = Array.prototype.slice.call(document.images || []);

          if (!images.length) {
            return Promise.resolve();
          }

          return Promise.race([
            Promise.all(images.map(function (image) {
              if (image.complete) {
                return Promise.resolve();
              }

              return new Promise(function (resolve) {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
              });
            })),
            new Promise(function (resolve) { window.setTimeout(resolve, 2800); }),
          ]);
        }

        function schedulePrint(tiles) {
          var printed = false;
          var printReport = function () {
            if (printed) return;
            printed = true;
            waitForFonts().then(waitForImages).then(function () {
              window.setTimeout(function () {
                window.focus();
                window.print();
              }, 350);
            });
          };

          if (tiles && typeof tiles.once === 'function') {
            tiles.once('load', function () { window.setTimeout(printReport, 650); });
          }
          window.setTimeout(printReport, 2300);
        }

        if (document.readyState === 'complete') {
          initMap();
        } else {
          window.addEventListener('load', initMap, { once: true });
        }
      })();
    </script>
  </body>
</html>`;
}

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const url = new URL(request.url);
    const rawFormat = asText(url.searchParams.get("format")).toLowerCase();
    const format = rawFormat || "pdf";

    if (format !== "pdf" && format !== "xlsx") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Only PDF and XLSX exports are available for Asset Map Tracking.",
        },
        { status: 400 },
      );
    }

    const scopedResult = await loadScopedMappedAssets(session.user.id, url);
    const printableAssets = scopedResult.assets.map(toPrintableAsset);
    const now = new Date();

    if (format === "xlsx") {
      const workbook = buildAssetGpsWorkbook(
        printableAssets,
        scopedResult.scopeLabel,
        now,
      );
      const filename = buildXlsxFilename(scopedResult.scopeSegment, now);

      return new NextResponse(workbook, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(workbook.length),
          "Cache-Control": "no-store",
        },
      });
    }

    const rawLogoUrl = await getAssetRegisterReportLogoUrl(session.user.id).catch(
      () => "",
    );
    const logoUrl = await resolveReportLogoUrlForHtml(rawLogoUrl, request.url);
    const html = buildReportHtml(printableAssets, {
      generatedDate: formatDate(now),
      generatedTime: formatTime(now),
      ownerEmail: asText(session.user.email),
      logoUrl,
      scopeLabel: scopedResult.scopeLabel,
    });
    const filename = buildReportFilename(
      printableAssets,
      scopedResult.scopeSegment,
      now,
    );

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("asset map report failed", error);

    if (
      error instanceof Error &&
      error.message === "ASSET_MAP_REGISTER_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The selected asset register could not be found for this account.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to build the Asset Map Tracking report.",
      },
      { status: 500 },
    );
  }
}
