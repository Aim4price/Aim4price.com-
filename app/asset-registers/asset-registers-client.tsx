"use client";

import DropdownOverlay from '../../components/DropdownOverlay';
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type SVGProps,
} from "react";
import AppHeader from "../../components/AppHeader";
import {
  openAssetRegisterSummaryPrint,
  type AssetRegisterSummaryRow,
  type ReportKeyValue,
} from "../../lib/report-print";
import { openCanonicalReportUrl } from "../../lib/report-open";
import styles from "./page.module.css";

type NoticeTone = "success" | "error";
type ExportFormat = "pdf" | "xlsx";
type ExportScope = "all" | "single" | "combined";
type ExportMode = "download" | "summary";
type ExportFlowStep = "closed" | "choice" | "single-picker" | "combined-picker" | "format";
type QrLabelLayout = "full-labels-10-per-page" | "small-qr-25mm";

const COMBINED_REGISTER_ID = "__combined_asset_registers__";


type AssetRegisterSummary = {
  id: string;
  userId: string;
  businessName: string;
  email: string;
  phone: string;
  addressLine1: string;
  logoUrls: string[];
  showLogosOnRegister: boolean;
  isPrimary: boolean;
  isSelected: boolean;
  assetCount: number;
  totalValue: number;
  totalReplacementPrice: number;
  createdAtIso: string;
  updatedAtIso: string;
};

type AssetStatusChoice = "yes" | "no" | "unknown" | "not_applicable";

type AssetRegisterDocument = {
  id?: string;
  url?: string;
  fileName?: string;
  contentType?: string;
  byteSize?: number;
  uploadedAtIso?: string;
};

type RegisterAsset = {
  id: string;
  userId: string;
  registerId: string | null;
  kind: string;
  title: string;
  value: number;
  replacementPriceExVat: number | null;
  selectedMethod?: string | null;
  serialNumber: string;
  brandName: string;
  modelName: string;
  typedModelName?: string;
  equipmentFamilyLabel?: string;
  drive?: string;
  hours?: number | null;
  estimatedHours?: number | null;
  lifeWorkedPercent?: number | null;
  condition?: string;
  yearModel: number | null;
  photos?: string[];
  documents?: AssetRegisterDocument[];
  specsJson?: Record<string, unknown>;
  isFinanced?: boolean;
  financeNote?: string;
  isInsured?: boolean;
  insuredValueExVat?: number | null;
  isLicensed?: boolean;
  licenseRegistrationNumber?: string;
  publicAssetCode?: string;
  plateLabel?: string;
  createdAtIso?: string;
  updatedAtIso: string;
  registerName?: string;
};

type QrLabelAsset = {
  id: string;
  title: string;
  plateLabel: string;
  publicAssetCode: string;
  kind: string;
  registerName: string;
  hasQr: boolean;
};

type QrLabelsApiResponse = {
  ok: boolean;
  assets?: QrLabelAsset[];
  error?: string;
};

type AssetRegistersApiResponse = {
  ok: boolean;
  registers?: AssetRegisterSummary[];
  selectedRegister?: AssetRegisterSummary;
  register?: AssetRegisterSummary;
  movedCount?: number;
  deletedRegisterId?: string;
  error?: string;
};

type AssetRegisterItemsApiResponse = {
  ok: boolean;
  register?: AssetRegisterSummary;
  items?: RegisterAsset[];
  assets?: RegisterAsset[];
  error?: string;
};

type AssetUploadApiResponse = {
  ok: boolean;
  uploads?: Array<{
    uploadId?: string;
    url?: string;
    fileName?: string;
    contentType?: string;
    byteSize?: number;
  }>;
  register?: AssetRegisterSummary;
  error?: string;
};

type RegisterLogoUploadResult = {
  logoUrls: string[];
  register?: AssetRegisterSummary;
};

type RegisterDraft = {
  businessName: string;
  email: string;
  phone: string;
  addressLine1: string;
  logoUrls: string[];
  showLogosOnRegister: boolean;
};

const MAX_REGISTER_LOGOS = 1;
const MAX_REGISTER_LOGO_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_REGISTER_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const emptyRegisterDraft: RegisterDraft = {
  businessName: "",
  email: "",
  phone: "",
  addressLine1: "",
  logoUrls: [],
  showLogosOnRegister: true,
};

function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}

function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </IconBase>
  );
}

function SummaryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </IconBase>
  );
}

function QrCodeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3h-3z" />
      <path d="M18 14h3v3" />
      <path d="M14 18v3h3" />
      <path d="M19 19h2v2h-2z" />
    </IconBase>
  );
}

function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </IconBase>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  );
}

function OpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </IconBase>
  );
}

function GearIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 15.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.15 2.15 0 1 1-3.04 3.04l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.08 1.65v.09a2.15 2.15 0 1 1-4.3 0v-.09a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-1.98.36l-.04.04a2.15 2.15 0 1 1-3.04-3.04l.04-.04A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.65-1.08h-.1a2.15 2.15 0 1 1 0-4.3h.1A1.8 1.8 0 0 0 4.6 8.54a1.8 1.8 0 0 0-.36-1.98l-.04-.04a2.15 2.15 0 1 1 3.04-3.04l.04.04a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 10.34 2.2V2.1a2.15 2.15 0 1 1 4.3 0v.1a1.8 1.8 0 0 0 1.08 1.65 1.8 1.8 0 0 0 1.98-.36l.04-.04a2.15 2.15 0 1 1 3.04 3.04l-.04.04a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.65 1.08h.1a2.15 2.15 0 1 1 0 4.3h-.1A1.8 1.8 0 0 0 19.4 15Z" />
    </IconBase>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </IconBase>
  );
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

function buildOpenHref(registerId: string, accountantShareId?: string, registerBaseHref = '/asset-register'): string {
  return accountantShareId
    ? `/accountant/registers/${encodeURIComponent(accountantShareId)}?registerId=${encodeURIComponent(registerId)}`
    : `${registerBaseHref}?registerId=${encodeURIComponent(registerId)}`;
}

function buildCombinedOpenHref(accountantShareId?: string, registerBaseHref = '/asset-register'): string {
  return accountantShareId
    ? `/accountant/registers/${encodeURIComponent(accountantShareId)}?scope=combined`
    : `${registerBaseHref}?scope=combined`;
}

function normalizeLogoUrls(value: unknown): string[] {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const logoUrls: string[] = [];

  for (const entry of source) {
    const logoUrl = String(entry ?? "").trim();

    if (!logoUrl || seen.has(logoUrl)) {
      continue;
    }

    seen.add(logoUrl);
    logoUrls.push(logoUrl);

    if (logoUrls.length >= MAX_REGISTER_LOGOS) {
      break;
    }
  }

  return logoUrls;
}

function visibleLogoUrls(register: Pick<AssetRegisterSummary, "logoUrls" | "showLogosOnRegister">): string[] {
  if (!register.showLogosOnRegister) {
    return [];
  }

  return normalizeLogoUrls(register.logoUrls);
}

function formatUploadSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${Number.isInteger(megabytes) ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}

function draftFromRegister(register: AssetRegisterSummary): RegisterDraft {
  return {
    businessName: register.businessName,
    email: register.email,
    phone: register.phone,
    addressLine1: register.addressLine1,
    logoUrls: normalizeLogoUrls(register.logoUrls),
    showLogosOnRegister: register.showLogosOnRegister,
  };
}

function money(value: unknown): string {
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Math.round(safeValue));
}

function registerContactParts(register: AssetRegisterSummary): { primary: string; email: string } {
  const primary = [register.phone, register.addressLine1]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" • ");
  const email = String(register.email ?? "").trim();

  return { primary, email };
}

function contactLine(register: AssetRegisterSummary): string {
  const { primary, email } = registerContactParts(register);
  const parts = [primary, email].filter(Boolean);

  return parts.join(" • ") || "No contact details saved yet";
}

type RegisterContactDetailsProps = {
  register: AssetRegisterSummary;
  className?: string;
};

function RegisterContactDetails({ register, className = "" }: RegisterContactDetailsProps) {
  const { primary, email } = registerContactParts(register);

  if (!primary && !email) {
    return <span className={`${styles.registerContactDetails} ${className}`.trim()}>No contact details saved yet</span>;
  }

  return (
    <span className={`${styles.registerContactDetails} ${className}`.trim()}>
      {primary ? <span className={styles.registerContactPrimary}>{primary}</span> : null}
      {email ? <span className={styles.registerContactEmail}>{email}</span> : null}
    </span>
  );
}

function compactAssetMeta(asset: RegisterAsset): string {
  const parts = [
    asset.serialNumber ? `Serial: ${asset.serialNumber}` : "",
    asset.brandName,
    asset.modelName,
    asset.yearModel ? String(asset.yearModel) : "",
  ].filter(Boolean);

  return parts.join(" • ") || "No asset details saved";
}

function matchesManagedAssetSearch(asset: RegisterAsset, searchTerm: string): boolean {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const searchableText = [
    asset.id,
    asset.title,
    compactAssetMeta(asset),
    asset.kind,
    asset.brandName,
    asset.modelName,
    asset.typedModelName,
    asset.equipmentFamilyLabel,
    asset.serialNumber,
    asset.yearModel ? String(asset.yearModel) : "",
    money(asset.value),
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedSearch);
}

function matchesRegisterSearch(
  register: AssetRegisterSummary,
  searchTerm: string,
): boolean {
  const normalizedSearch = searchTerm.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const searchableText = [
    register.businessName,
    register.email,
    register.phone,
    register.addressLine1,
    normalizeLogoUrls(register.logoUrls).length ? "logo logos branding farm" : "no logo trust placeholder",
    register.showLogosOnRegister ? "show logo visible" : "hide logo hidden",
    register.isSelected ? "selected active current" : "",
    register.isPrimary ? "primary main" : "",
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedSearch);
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.error === "string" && record.error.trim())
      return record.error;
    if (typeof record.message === "string" && record.message.trim())
      return record.message;
  }

  return fallback;
}

function parseDownloadFileName(response: Response, fallback: string): string {
  const disposition = response.headers.get("content-disposition") || "";
  const quotedMatch = /filename="([^"]+)"/i.exec(disposition);
  const plainMatch = /filename=([^;]+)/i.exec(disposition);

  return (quotedMatch?.[1] || plainMatch?.[1] || fallback).trim();
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function slugFallback(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "asset-registers"
  );
}

function buildDefaultEntityName(scope: ExportScope, selectedRegisters: AssetRegisterSummary[]): string {
  if (scope === "single" && selectedRegisters[0]?.businessName) {
    return selectedRegisters[0].businessName;
  }

  if (scope === "combined") {
    return "Merged Asset Registers";
  }

  return selectedRegisters.length === 1 && selectedRegisters[0]?.businessName
    ? selectedRegisters[0].businessName
    : "All Asset Registers";
}

function buildExportUrl(
  format: ExportFormat,
  scope: ExportScope,
  selectedRegisterIds: string[],
  entityName: string,
  accountantShareId?: string,
): string {
  const params = new URLSearchParams({
    format,
    scope,
    entityName: entityName.trim(),
  });

  if (scope !== "all") {
    params.set("registerIds", selectedRegisterIds.join(","));
  }
  if (accountantShareId) params.set("accountantShareId", accountantShareId);

  return `/api/asset-register/export?${params.toString()}`;
}

function buildScopedSummaryUrl(
  scope: ExportScope,
  selectedRegisterIds: string[],
  entityName: string,
  accountantShareId?: string,
): string {
  const params = new URLSearchParams({
    format: "html",
    reportKind: "summary",
    scope,
  });
  const cleanedEntityName = entityName.trim();

  if (cleanedEntityName) {
    params.set("entityName", cleanedEntityName);
  }

  if (scope !== "all") {
    params.set("registerIds", selectedRegisterIds.join(","));
  }
  if (accountantShareId) params.set("accountantShareId", accountantShareId);

  return `/api/asset-register/export?${params.toString()}`;
}

function registerExportSearchText(register: AssetRegisterSummary): string {
  return [
    register.businessName,
    register.email,
    register.phone,
    register.addressLine1,
    `${register.assetCount} assets`,
    money(register.totalValue),
    money(register.totalReplacementPrice),
  ]
    .join(" ")
    .toLowerCase();
}

function matchesExportRegisterSearch(register: AssetRegisterSummary, searchTerm: string): boolean {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  return !normalizedSearch || registerExportSearchText(register).includes(normalizedSearch);
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function numericValue(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatReportDate(value?: string | Date | null): string {
  const parsed = value instanceof Date ? value : value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  return safeDate.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function normalizeAssetStatusChoice(value: unknown, fallback: AssetStatusChoice = "unknown"): AssetStatusChoice {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (["yes", "y", "true", "financed", "insured", "licensed", "licenced"].includes(normalized)) {
    return "yes";
  }

  if (["no", "n", "false", "not_financed", "not_insured", "not_licensed", "not_licenced", "unfinanced", "uninsured", "unlicensed", "unlicenced"].includes(normalized)) {
    return "no";
  }

  if (["na", "n_a", "not_applicable", "not_aplicable", "not_relevant", "does_not_apply"].includes(normalized)) {
    return "not_applicable";
  }

  if (["unknown", "not_sure", "unsure", "maybe", ""].includes(normalized)) {
    return normalized ? "unknown" : fallback;
  }

  return fallback;
}

function statusChoiceReportLabel(status: AssetStatusChoice): string {
  const normalized = normalizeAssetStatusChoice(status);
  if (normalized === "yes") return "Yes";
  if (normalized === "no") return "No";
  if (normalized === "not_applicable") return "N/A";
  return "Not sure";
}

function readFinanceStatusChoice(asset: RegisterAsset): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.financeStatus ?? specs.finance_status ?? specs.financedStatus ?? specs.financed_status,
    asset.isFinanced ? "yes" : "no",
  );
}

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

function readAssetInsuredValueExVat(asset: RegisterAsset): number | null {
  const direct = numericValue(asset.insuredValueExVat);
  if (direct !== null && direct > 0) return Math.round(direct);

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  for (const key of INSURED_VALUE_SPEC_KEYS) {
    const value = numericValue(specs[key]);
    if (value !== null && value > 0) return Math.round(value);
  }

  return null;
}

function readInsuranceStatusChoice(asset: RegisterAsset): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.insuranceStatus ?? specs.insurance_status ?? specs.insuredStatus ?? specs.insured_status,
    asset.isInsured || readAssetInsuredValueExVat(asset) !== null ? "yes" : "no",
  );
}

function readLicenseStatusChoice(asset: RegisterAsset): AssetStatusChoice {
  if (asset.kind === "property") return "not_applicable";

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

function readLicenseRegistrationNumber(asset: RegisterAsset): string {
  const direct = cleanText(asset.licenseRegistrationNumber).toUpperCase();
  if (direct) return direct;

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return cleanText(
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

function readAssetReplacementPriceExVat(asset: RegisterAsset): number | null {
  const direct = numericValue(asset.replacementPriceExVat);
  if (direct !== null && direct > 0) return Math.round(direct);

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  for (const key of REPLACEMENT_PRICE_SPEC_KEYS) {
    const value = numericValue(specs[key]);
    if (value !== null && value > 0) return Math.round(value);
  }

  return null;
}

function assetKindLabel(asset: RegisterAsset): string {
  if (asset.equipmentFamilyLabel) return asset.equipmentFamilyLabel;
  if (asset.kind === "tractor") return "Tractors";
  if (asset.kind === "property") return "Property / Land / Building";
  if (asset.kind === "vehicle") return "Vehicle";
  if (asset.kind === "tools") return "Tools";
  if (asset.kind === "stock") return "Stock";
  if (asset.kind === "equipment" || Boolean(asset.brandName && asset.modelName && asset.yearModel)) return "Equipment";
  return "Equipment";
}

function conditionLabel(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
    used: "Used",
    serious: "Requires attention",
  };

  return labels[normalized] ?? cleanText(value);
}

function normalizeUsageMetric(asset: RegisterAsset): string {
  if (asset.kind === "vehicle") return "km";

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return String(
    specs.usageMetric ??
      specs.usage_metric ??
      specs.usageUnit ??
      specs.usage_unit ??
      specs.usageType ??
      specs.usage_type ??
      "",
  )
    .trim()
    .toLowerCase();
}

function buildAssetUsageValue(asset: RegisterAsset): string {
  if (asset.kind === "property") return "—";

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const rawUsageMode = String(
    specs.usageMode ??
      specs.usage_mode ??
      specs.usageMetricType ??
      specs.usage_metric_type ??
      specs.valuationMode ??
      specs.valuation_mode ??
      "",
  )
    .trim()
    .toLowerCase();
  const normalized = normalizeUsageMetric(asset);
  const hours = numericValue(asset.hours);
  const estimatedHours = numericValue(asset.estimatedHours);
  const lifeWorkedPercent = numericValue(asset.lifeWorkedPercent);

  if (asset.kind === "vehicle") {
    return hours !== null && hours > 0 ? `${Math.round(hours).toLocaleString("en-ZA")} km` : "—";
  }

  if (
    ["percent", "percentage", "%", "percent_used", "percent used", "life_worked_percent", "life worked percent"].includes(normalized) ||
    ["percent", "percentage", "percent_used", "percentage_depreciation", "wear_class"].includes(rawUsageMode)
  ) {
    return lifeWorkedPercent !== null ? `${Math.round(lifeWorkedPercent)}% worked` : "—";
  }

  if (hours !== null && hours > 0) {
    return `${Math.round(hours).toLocaleString("en-ZA")} hours`;
  }

  if (lifeWorkedPercent !== null) {
    return `${Math.round(lifeWorkedPercent)}% worked`;
  }

  if (estimatedHours !== null && estimatedHours > 0) {
    return `${Math.round(estimatedHours).toLocaleString("en-ZA")} hours`;
  }

  return "—";
}

function methodLabel(value: unknown): string {
  return String(value ?? "").trim().toLowerCase() === "manual" ? "Manual" : "Aim4price";
}

function assetStatusDateLabel(asset: RegisterAsset): string {
  const createdDate = asset.createdAtIso ? new Date(asset.createdAtIso) : null;
  const updatedDate = asset.updatedAtIso ? new Date(asset.updatedAtIso) : null;
  const hasUpdatedDate = updatedDate && !Number.isNaN(updatedDate.getTime());
  const hasCreatedDate = createdDate && !Number.isNaN(createdDate.getTime());
  const isSavedOnly = hasCreatedDate && hasUpdatedDate && Math.abs(updatedDate.getTime() - createdDate.getTime()) < 1000;
  const label = isSavedOnly ? "Saved" : "Updated";

  return hasUpdatedDate ? `${label} ${formatReportDate(updatedDate)}` : "Saved";
}

function propertySizeDisplay(asset: RegisterAsset): string {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const value = cleanText(
    specs.propertySize ??
      specs.property_size ??
      specs.size ??
      specs.sizeText ??
      specs.size_text,
  );

  return value || "—";
}

function buildReportModelName(asset: RegisterAsset): string {
  if (asset.kind === "property") return `Size: ${propertySizeDisplay(asset)}`;
  return cleanText(asset.modelName || asset.typedModelName) || "—";
}

function buildReportBrandName(asset: RegisterAsset): string {
  if (asset.kind === "property") return "—";
  return cleanText(asset.brandName) || "—";
}

function normalizePhotoUrls(value: unknown): string[] {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of source) {
    const url = String(entry ?? "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }

  return result;
}

function toAbsoluteUrl(value?: string | null): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^(https?:|data:|blob:)/i.test(text)) return text;
  if (typeof window === "undefined") return text;

  try {
    return new URL(text, window.location.origin).toString();
  } catch {
    return text;
  }
}

function registerLogoForReport(registers: AssetRegisterSummary[]): string {
  for (const register of registers) {
    const logo = visibleLogoUrls(register)[0];
    if (logo) return toAbsoluteUrl(logo) ?? logo;
  }

  return "";
}

type ExportRegisterBundle = {
  register: AssetRegisterSummary;
  items: RegisterAsset[];
};

function sumAssetValues(items: RegisterAsset[]): number {
  return items.reduce((sum, asset) => sum + Math.round(numericValue(asset.value) ?? 0), 0);
}

function sumAssetReplacementValues(items: RegisterAsset[]): number {
  return items.reduce((sum, asset) => sum + Math.round(readAssetReplacementPriceExVat(asset) ?? 0), 0);
}

function sumAssetInsuredValues(items: RegisterAsset[]): number {
  return items.reduce((sum, asset) => sum + Math.round(readAssetInsuredValueExVat(asset) ?? 0), 0);
}

function countAssetsWithReplacementPrice(items: RegisterAsset[]): number {
  return items.filter((asset) => readAssetReplacementPriceExVat(asset) !== null).length;
}

function calculateAssetStats(items: RegisterAsset[], predicate: (asset: RegisterAsset) => boolean): { count: number; value: number } {
  return items.reduce(
    (stats, asset) => {
      if (!predicate(asset)) return stats;
      return {
        count: stats.count + 1,
        value: stats.value + Math.round(numericValue(asset.value) ?? 0),
      };
    },
    { count: 0, value: 0 },
  );
}

function buildReportOwnerMeta(scope: ExportScope, registers: AssetRegisterSummary[], bundles: ExportRegisterBundle[]): string {
  if (scope === "single" && registers[0]) {
    return contactLine(registers[0]);
  }

  const totalAssets = bundles.reduce((sum, bundle) => sum + bundle.items.length, 0);
  const firstContact = registers[0] ? contactLine(registers[0]) : "";
  const registerSummary = `${registers.length} asset register${registers.length === 1 ? "" : "s"} • ${totalAssets} asset${totalAssets === 1 ? "" : "s"}`;

  return [registerSummary, firstContact].filter(Boolean).join(" • ");
}

function buildReportOwnerRows(scope: ExportScope, registers: AssetRegisterSummary[], entityName: string): ReportKeyValue[] {
  if (scope === "single" && registers[0]) {
    const register = registers[0];

    return [
      { label: "Name", value: register.businessName || entityName },
      { label: "Business email", value: register.email || "—" },
      { label: "Phone", value: register.phone || "—" },
      { label: "Address", value: register.addressLine1 || "—" },
    ];
  }

  return [
    { label: "Report name", value: entityName },
    { label: "Included registers", value: registers.map((register) => register.businessName).filter(Boolean).join(", ") || "—" },
    { label: "Primary contact", value: registers[0] ? contactLine(registers[0]) : "—" },
  ];
}

function buildExportReportRows(bundles: ExportRegisterBundle[], scope: ExportScope): AssetRegisterSummaryRow[] {
  return bundles.flatMap((bundle) =>
    bundle.items.map((asset) => {
      const replacementPrice = readAssetReplacementPriceExVat(asset);
      const insuredValue = readAssetInsuredValueExVat(asset);
      const sourcePrefix = scope === "single" ? "" : `Source: ${bundle.register.businessName} · `;
      const documentsCount = Array.isArray(asset.documents) ? asset.documents.length : 0;
      const photoUrl = toAbsoluteUrl(normalizePhotoUrls(asset.photos)[0] ?? null);
      const licenseRegistrationNumber = readLicenseRegistrationNumber(asset);

      return {
        asset: cleanText(asset.title) || "Asset",
        type: `${sourcePrefix}${assetKindLabel(asset)}`,
        method: methodLabel(asset.selectedMethod),
        detail: compactAssetMeta(asset),
        value: money(asset.value),
        replacementPrice: replacementPrice !== null ? money(replacementPrice) : "Not set",
        status: assetStatusDateLabel(asset),
        brand: buildReportBrandName(asset),
        model: buildReportModelName(asset),
        year: asset.yearModel ? String(asset.yearModel) : "—",
        usage: buildAssetUsageValue(asset),
        condition: conditionLabel(asset.condition) || "—",
        serial: asset.kind === "property" ? "—" : asset.serialNumber || "—",
        insured: statusChoiceReportLabel(readInsuranceStatusChoice(asset)),
        insuredValue: insuredValue !== null ? money(insuredValue) : "—",
        financed: statusChoiceReportLabel(readFinanceStatusChoice(asset)),
        licensed: asset.kind === "property" ? "N/A" : statusChoiceReportLabel(readLicenseStatusChoice(asset)),
        licenseRegistrationNumber: asset.kind === "property" ? undefined : licenseRegistrationNumber || undefined,
        documents: documentsCount ? `${documentsCount} saved` : "None",
        updated: assetStatusDateLabel(asset),
        photoUrl,
      };
    }),
  );
}

function buildExportReportTitle(scope: ExportScope): string {
  if (scope === "combined") return "Merged Asset Register Report";
  return "Full Asset Register Report";
}

function buildExportAssetSectionTitle(scope: ExportScope): string {
  if (scope === "combined") return "Merged Asset Register";
  return "Asset Register";
}

type RegisterLogoBlockProps = {
  register: AssetRegisterSummary;
  isUploading: boolean;
  disabled: boolean;
  logoRevision: number;
  onUpload: (
    register: AssetRegisterSummary,
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
};

function imageUrlWithRevision(url: string, revision: number): string {
  const trimmedUrl = String(url ?? "").trim();

  if (
    !trimmedUrl ||
    revision <= 0 ||
    trimmedUrl.startsWith("data:") ||
    trimmedUrl.startsWith("blob:")
  ) {
    return trimmedUrl;
  }

  return `${trimmedUrl}${trimmedUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(revision))}`;
}

function RegisterLogoBlock({
  register,
  isUploading,
  disabled,
  logoRevision,
  onUpload,
}: RegisterLogoBlockProps) {
  const logoUrl = visibleLogoUrls(register)[0] ?? "";
  const logoImageSrc = imageUrlWithRevision(logoUrl, logoRevision);
  const hasHiddenLogo = normalizeLogoUrls(register.logoUrls).length > 0 && !register.showLogosOnRegister;
  const uploadDisabled = disabled || isUploading;
  const uploadLabel = isUploading ? "Uploading logo..." : logoUrl ? "Replace logo" : "Upload logo";

  return (
    <label
      className={`${styles.registerLogoPanel} ${isUploading ? styles.registerLogoPanelUploading : ""} ${uploadDisabled ? styles.registerLogoPanelDisabled : ""}`}
      aria-label={`${uploadLabel} for ${register.businessName}`}
      title={uploadDisabled ? "Logo upload is temporarily unavailable" : uploadLabel}
    >
      <input
        className={styles.cardLogoUploadInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => onUpload(register, event)}
        disabled={uploadDisabled}
      />

      {logoUrl ? (
        <div className={`${styles.registerLogoGrid} ${styles.registerLogoGridSingle}`}>
          <div className={styles.registerLogoTile}>
            <img
              key={`${register.id}-${logoUrl}-${logoRevision}`}
              src={logoImageSrc}
              alt={`${register.businessName} logo`}
            />
          </div>
        </div>
      ) : (
        <div className={styles.registerLogoPlaceholder}>
          <span>Logo</span>
          <small>{hasHiddenLogo ? "Hidden on cards" : "Optional"}</small>
        </div>
      )}

      <span className={styles.cardLogoHoverOverlay} aria-hidden="true">
        <PlusIcon className={styles.buttonIcon} />
        <span>{isUploading ? "Uploading..." : logoUrl ? "Replace logo" : "Upload logo"}</span>
        <small>JPG, PNG or WEBP</small>
      </span>
    </label>
  );
}

type RegisterTargetDropdownProps = {
  dropdownId: string;
  value: string;
  targets: AssetRegisterSummary[];
  placeholder: string;
  disabled?: boolean;
  openDropdownId: string | null;
  onOpenDropdownChange: (dropdownId: string | null) => void;
  onChange: (value: string) => void;
};

function RegisterTargetDropdown({
  dropdownId,
  value,
  targets,
  placeholder,
  disabled = false,
  openDropdownId,
  onOpenDropdownChange,
  onChange,
}: RegisterTargetDropdownProps) {
  const targetSelectRef = useRef<HTMLDivElement | null>(null);
  const targetMenuRef = useRef<HTMLDivElement | null>(null);
  const targetTriggerRef = useRef<HTMLButtonElement | null>(null);
  const targetSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [targetSearchTerm, setTargetSearchTerm] = useState("");
  const selectedTarget = targets.find((target) => target.id === value) ?? null;
  const isDisabled = disabled || !targets.length;
  const isOpen = openDropdownId === dropdownId && !isDisabled;
  const hasTargetSearch = Boolean(targetSearchTerm.trim());
  const visibleTargets = useMemo(
    () => targets.filter((target) => matchesRegisterSearch(target, targetSearchTerm)),
    [targetSearchTerm, targets],
  );
  const targetListboxId = `register-target-options-${dropdownId}`;
  const displayLabel = selectedTarget
    ? selectedTarget.businessName
    : targets.length
      ? placeholder
      : "No target register available";

  useEffect(() => {
    if (!isOpen) {
      setTargetSearchTerm("");
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      targetSearchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isOpen]);

  function closeDropdown({ restoreFocus = false }: { restoreFocus?: boolean } = {}) {
    setTargetSearchTerm("");
    onOpenDropdownChange(null);

    if (restoreFocus) {
      window.requestAnimationFrame(() => targetTriggerRef.current?.focus());
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextFocus = event.relatedTarget;

    if (
      !(nextFocus instanceof Node) ||
      (!targetSelectRef.current?.contains(nextFocus) &&
        !targetMenuRef.current?.contains(nextFocus))
    ) {
      closeDropdown();
    }
  }

  return (
    <div ref={targetSelectRef} className={styles.targetSelect} onBlur={handleBlur}>
      <button
        ref={targetTriggerRef}
        type="button"
        className={`${styles.targetSelectButton} ${
          !selectedTarget ? styles.targetSelectButtonPlaceholder : ""
        } ${isOpen ? styles.targetSelectButtonOpen : ""}`}
        onClick={() => {
          if (isOpen) {
            closeDropdown();
            return;
          }

          setTargetSearchTerm("");
          onOpenDropdownChange(dropdownId);
        }}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? targetListboxId : undefined}
      >
        <span>{displayLabel}</span>
        <ChevronDownIcon className={styles.targetSelectChevron} />
      </button>

      {isOpen ? (
        <DropdownOverlay
          className={styles.targetSelectMenu}
          anchorRef={targetTriggerRef}
          maxHeight={360}
        >
          <div ref={targetMenuRef} className={styles.targetSelectMenuContent} onBlur={handleBlur}>
            <div className={styles.targetSelectSearch} role="search">
              <SearchIcon className={styles.targetSelectSearchIcon} aria-hidden="true" />
              <input
                ref={targetSearchInputRef}
                type="search"
                className={styles.targetSelectSearchInput}
                value={targetSearchTerm}
                onChange={(event) => setTargetSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  closeDropdown({ restoreFocus: true });
                }}
                placeholder="Search asset registers..."
                aria-label="Search target asset registers"
                aria-controls={targetListboxId}
              />
              {targetSearchTerm ? (
                <button
                  type="button"
                  className={styles.targetSelectSearchClear}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setTargetSearchTerm("");
                    window.requestAnimationFrame(() => targetSearchInputRef.current?.focus());
                  }}
                  aria-label="Clear target register search"
                >
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
            </div>

            <div className={styles.targetSelectOptions}>
              <div id={targetListboxId} className={styles.targetSelectOptionList} role="listbox" aria-label="Target asset registers">
                {!hasTargetSearch ? (
                  <button
                    type="button"
                    className={`${styles.targetSelectOption} ${
                      !value ? styles.targetSelectOptionSelected : ""
                    }`}
                    role="option"
                    aria-selected={!value}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange("");
                      closeDropdown({ restoreFocus: true });
                    }}
                  >
                    <span>{placeholder}</span>
                    <small>Select a register before moving assets.</small>
                  </button>
                ) : null}

                {visibleTargets.map((target) => {
                  const isSelected = target.id === value;

                  return (
                    <button
                      key={target.id}
                      type="button"
                      className={`${styles.targetSelectOption} ${
                        isSelected ? styles.targetSelectOptionSelected : ""
                      }`}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onChange(target.id);
                        closeDropdown({ restoreFocus: true });
                      }}
                    >
                      <span>{target.businessName}</span>
                      <small>
                        {`${target.assetCount} asset${
                          target.assetCount === 1 ? "" : "s"
                        } · ${money(target.totalValue)} register value`}
                      </small>
                    </button>
                  );
                })}
              </div>

              {hasTargetSearch && !visibleTargets.length ? (
                <div className={styles.targetSelectEmpty} role="status" aria-live="polite">
                  <strong>No asset registers match your search.</strong>
                  <small>Try another register name or clear the search.</small>
                </div>
              ) : null}
            </div>
          </div>
        </DropdownOverlay>
      ) : null}
    </div>
  );
}

export default function AssetRegistersClient({
  accountantShareId,
  showAppHeader = true,
  registerBaseHref = '/asset-register',
  showCombinedRegister = true,
}: {
  accountantShareId?: string;
  showAppHeader?: boolean;
  registerBaseHref?: string;
  showCombinedRegister?: boolean;
} = {}) {
  const router = useRouter();
  const registersApiUrl = accountantShareId
    ? `/api/accountant/registers/${encodeURIComponent(accountantShareId)}/owner-registers`
    : "/api/asset-registers";
  const registerItemsApiUrl = (registerId: string) => accountantShareId
    ? `/api/accountant/registers/${encodeURIComponent(accountantShareId)}?registerId=${encodeURIComponent(registerId)}`
    : `/api/asset-register?registerId=${encodeURIComponent(registerId)}`;
  const [registers, setRegisters] = useState<AssetRegisterSummary[]>([]);
  const [createDraft, setCreateDraft] =
    useState<RegisterDraft>(emptyRegisterDraft);
  const [editDraft, setEditDraft] = useState<RegisterDraft>(emptyRegisterDraft);
  const [registerSearchTerm, setRegisterSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [managedRegisterId, setManagedRegisterId] = useState("");
  const [managedAssets, setManagedAssets] = useState<RegisterAsset[]>([]);
  const [managedAssetSearchTerm, setManagedAssetSearchTerm] = useState("");
  const [isEditDetailsModalOpen, setIsEditDetailsModalOpen] = useState(false);
  const [assetMoveTargets, setAssetMoveTargets] = useState<
    Record<string, string>
  >({});
  const [deleteCandidateRegister, setDeleteCandidateRegister] =
    useState<AssetRegisterSummary | null>(null);
  const [deleteTargetRegisterId, setDeleteTargetRegisterId] = useState("");
  const [notice, setNotice] = useState<{
    tone: NoticeTone;
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingRegisterLogoId, setUploadingRegisterLogoId] = useState<string | null>(null);
  const [logoRevisions, setLogoRevisions] = useState<Record<string, number>>({});
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [manageSaveState, setManageSaveState] = useState<"idle" | "saved">("idle");
  const [isLoadingManagedAssets, setIsLoadingManagedAssets] = useState(false);
  const [selectingRegisterId, setSelectingRegisterId] = useState<string | null>(
    null,
  );
  const [movingAssetId, setMovingAssetId] = useState<string | null>(null);
  const [openTargetDropdownId, setOpenTargetDropdownId] = useState<
    string | null
  >(null);
  const [removingRegisterId, setRemovingRegisterId] = useState<string | null>(
    null,
  );
  const [exportMode, setExportMode] = useState<ExportMode>("download");
  const [exportStep, setExportStep] = useState<ExportFlowStep>("closed");
  const [exportScope, setExportScope] = useState<ExportScope>("all");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exportEntityName, setExportEntityName] = useState("");
  const [exportRegisterSearch, setExportRegisterSearch] = useState("");
  const [selectedExportRegisterIds, setSelectedExportRegisterIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrAssets, setQrAssets] = useState<QrLabelAsset[]>([]);
  const [selectedQrAssetIds, setSelectedQrAssetIds] = useState<string[]>([]);
  const [qrLayout, setQrLayout] = useState<QrLabelLayout>("full-labels-10-per-page");
  const [qrAssetSearch, setQrAssetSearch] = useState("");
  const [isLoadingQrAssets, setIsLoadingQrAssets] = useState(false);
  const [isGeneratingQrPdf, setIsGeneratingQrPdf] = useState(false);
  const [qrError, setQrError] = useState("");
  const manageIntentHandledRef = useRef(false);

  const combinedRegister = useMemo<AssetRegisterSummary | null>(() => {
    if (!showCombinedRegister || !registers.length) return null;

    const newestUpdatedAt = registers.reduce(
      (latest, register) => register.updatedAtIso > latest ? register.updatedAtIso : latest,
      registers[0]?.updatedAtIso ?? new Date(0).toISOString(),
    );

    return {
      id: COMBINED_REGISTER_ID,
      userId: registers[0]?.userId ?? "",
      businessName: "Combined Asset Registers",
      email: "",
      phone: "",
      addressLine1: "All asset registers on this account",
      logoUrls: [],
      showLogosOnRegister: false,
      isPrimary: false,
      isSelected: false,
      assetCount: registers.reduce((sum, register) => sum + register.assetCount, 0),
      totalValue: registers.reduce((sum, register) => sum + register.totalValue, 0),
      totalReplacementPrice: registers.reduce((sum, register) => sum + register.totalReplacementPrice, 0),
      createdAtIso: registers[0]?.createdAtIso ?? newestUpdatedAt,
      updatedAtIso: newestUpdatedAt,
    };
  }, [registers, showCombinedRegister]);

  const managedRegister = useMemo(
    () => managedRegisterId === COMBINED_REGISTER_ID
      ? combinedRegister
      : registers.find((register) => register.id === managedRegisterId) ?? null,
    [combinedRegister, managedRegisterId, registers],
  );
  const isManagingCombined = managedRegisterId === COMBINED_REGISTER_ID;
  const managedMoveTargets = useMemo(
    () =>
      managedRegister
        ? registers.filter((register) => register.id !== managedRegister.id)
        : [],
    [managedRegister, registers],
  );
  const visibleManagedAssets = useMemo(
    () =>
      managedAssets.filter((asset) =>
        matchesManagedAssetSearch(asset, managedAssetSearchTerm),
      ),
    [managedAssetSearchTerm, managedAssets],
  );
  const visibleRegisters = useMemo(
    () =>
      registers.filter((register) =>
        matchesRegisterSearch(register, registerSearchTerm),
      ),
    [registerSearchTerm, registers],
  );
  const visibleQrAssets = useMemo(() => {
    const query = qrAssetSearch.trim().toLowerCase();
    if (!query) return qrAssets;

    return qrAssets.filter((asset) => [
      asset.title,
      asset.plateLabel,
      asset.publicAssetCode,
      asset.registerName,
    ].some((value) => value.toLowerCase().includes(query)));
  }, [qrAssetSearch, qrAssets]);
  const exportPickerRegisters = useMemo(
    () =>
      registers.filter((register) =>
        matchesExportRegisterSearch(register, exportRegisterSearch),
      ),
    [exportRegisterSearch, registers],
  );
  const selectedExportRegisters = useMemo(
    () =>
      selectedExportRegisterIds
        .map((registerId) => registers.find((register) => register.id === registerId) ?? null)
        .filter((register): register is AssetRegisterSummary => Boolean(register)),
    [registers, selectedExportRegisterIds],
  );
  const selectedExportRegisterCount = selectedExportRegisterIds.length;
  const isExportFlowOpen = exportStep !== "closed";
  const isSummaryFlow = exportMode === "summary";
  const isCombinedSelectionValid = exportScope === "combined" && selectedExportRegisterCount >= 2;
  const exportTitle = exportStep === "choice"
    ? isSummaryFlow
      ? "Summaries"
      : "Download Asset Registers"
    : exportStep === "single-picker"
      ? "Choose specific Asset Register"
      : exportStep === "combined-picker"
        ? "Merge Asset Registers"
        : isSummaryFlow
          ? exportScope === "combined"
            ? "Merged Asset Register Summary"
            : "Asset Register Summary"
          : exportScope === "all"
            ? "Export All Asset Registers"
            : exportScope === "combined"
              ? "Export Merged Asset Registers"
              : "Export Asset Register";
  const exportIntro = exportStep === "choice"
    ? isSummaryFlow
      ? "Choose whether to summarise all registers, one register, or a selected merged set."
      : "Choose whether to export all registers, one register, or a selected merged set."
    : exportStep === "single-picker"
      ? isSummaryFlow
        ? "Select the saved asset register to summarise."
        : "Select the saved asset register to download."
      : exportStep === "combined-picker"
        ? isSummaryFlow
          ? "Select at least two asset registers to merge into one summary."
          : "Select at least two asset registers to merge into one export."
        : isSummaryFlow
          ? "Confirm the report name and open the PDF summary report."
          : "Confirm the report name and choose the export format.";
  const deleteMoveTargets = useMemo(
    () =>
      deleteCandidateRegister
        ? registers.filter(
            (register) => register.id !== deleteCandidateRegister.id,
          )
        : [],
    [deleteCandidateRegister, registers],
  );
  const isBlockingModalOpen =
    isCreateModalOpen ||
    Boolean(managedRegister) ||
    isEditDetailsModalOpen ||
    Boolean(deleteCandidateRegister) ||
    isExportFlowOpen ||
    isQrModalOpen;

  async function refreshRegisters(
    showLoading = false,
  ): Promise<AssetRegisterSummary[]> {
    if (showLoading) setIsLoading(true);

    try {
      const response = await fetch(registersApiUrl, {
        cache: "no-store",
        credentials: "include",
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (!response.ok || !data?.ok || !Array.isArray(data.registers)) {
        throw new Error(
          extractErrorMessage(payload, "Failed to load asset registers."),
        );
      }

      setRegisters(data.registers);
      return data.registers;
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load asset registers.",
      });
      return [];
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshRegisters(true);
  }, []);

  useEffect(() => {
    if (isLoading || manageIntentHandledRef.current || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedManageTarget = String(params.get("manage") ?? "").trim();

    if (!requestedManageTarget) {
      return;
    }

    const targetRegister = requestedManageTarget === "combined"
      ? combinedRegister
      : registers.find((register) => register.id === requestedManageTarget) ?? null;

    if (!targetRegister) {
      return;
    }

    manageIntentHandledRef.current = true;
    openManagePanel(targetRegister, String(params.get("assetId") ?? "").trim());
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [combinedRegister, isLoading, registers]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isBlockingModalOpen) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isQrModalOpen && !isGeneratingQrPdf) {
          closeQrModal();
          return;
        }

        if (openTargetDropdownId) {
          setOpenTargetDropdownId(null);
          return;
        }

        if (isExportFlowOpen && !isExporting) {
          closeExportFlow();
          return;
        }

        if (isEditDetailsModalOpen && !isSavingDetails) {
          closeManagedEditModal();
          return;
        }

        if (deleteCandidateRegister && !removingRegisterId) {
          closeDeleteRegisterDialog();
          return;
        }

        if (isCreateModalOpen && !isCreating) {
          closeCreateModal();
          return;
        }

        if (managedRegister && !isSavingDetails && !movingAssetId) {
          closeManagePanel();
        }
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [
    deleteCandidateRegister,
    isBlockingModalOpen,
    isCreateModalOpen,
    isCreating,
    isEditDetailsModalOpen,
    isExportFlowOpen,
    isExporting,
    isGeneratingQrPdf,
    isQrModalOpen,
    isSavingDetails,
    managedRegister,
    movingAssetId,
    openTargetDropdownId,
    removingRegisterId,
  ]);

  async function loadManagedAssets(register: AssetRegisterSummary, focusAssetId = "") {
    setIsLoadingManagedAssets(true);
    setManagedAssets([]);
    setManagedAssetSearchTerm("");
    setAssetMoveTargets({});

    try {
      const targetRegisters = register.id === COMBINED_REGISTER_ID ? registers : [register];
      const bundles = await Promise.all(targetRegisters.map(async (targetRegister) => {
        const response = await fetch(registerItemsApiUrl(targetRegister.id), {
          cache: "no-store",
          credentials: "include",
        });
        const payload = await readJsonPayload(response);
        const data = (payload ?? null) as AssetRegisterItemsApiResponse | null;

        if (!response.ok || !data?.ok) {
          throw new Error(
            extractErrorMessage(payload, `Failed to load assets for ${targetRegister.businessName}.`),
          );
        }

        const items = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.assets)
            ? data.assets
            : [];

        return items.map((asset) => ({
          ...asset,
          registerId: asset.registerId || targetRegister.id,
          registerName: targetRegister.businessName,
        }));
      }));

      const loadedAssets = bundles.flat();
      setManagedAssets(loadedAssets);

      if (focusAssetId && loadedAssets.some((asset) => asset.id === focusAssetId)) {
        setManagedAssetSearchTerm(focusAssetId);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load register assets.",
      });
    } finally {
      setIsLoadingManagedAssets(false);
    }
  }

  function openCreateModal() {
    setOpenTargetDropdownId(null);
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (isCreating) return;
    setIsCreateModalOpen(false);
    setCreateDraft(emptyRegisterDraft);
    setOpenTargetDropdownId(null);
  }

  function openManagePanel(register: AssetRegisterSummary, focusAssetId = "") {
    setOpenTargetDropdownId(null);
    setManagedRegisterId(register.id);
    setEditDraft(draftFromRegister(register));
    setManageSaveState("idle");
    void loadManagedAssets(register, focusAssetId);
  }

  function openCombinedRegister() {
    router.push(buildCombinedOpenHref(accountantShareId, registerBaseHref));
  }

  function closeManagePanel() {
    if (isSavingDetails || movingAssetId) return;
    setManagedRegisterId("");
    setEditDraft(emptyRegisterDraft);
    setManageSaveState("idle");
    setManagedAssets([]);
    setManagedAssetSearchTerm("");
    setAssetMoveTargets({});
    setIsEditDetailsModalOpen(false);
    setOpenTargetDropdownId(null);
  }

  function openManagedEditModal() {
    if (!managedRegister) return;
    setEditDraft(draftFromRegister(managedRegister));
    setManageSaveState("idle");
    setIsEditDetailsModalOpen(true);
  }

  function closeManagedEditModal() {
    if (isSavingDetails) return;
    setIsEditDetailsModalOpen(false);
    setManageSaveState("idle");
    setOpenTargetDropdownId(null);
  }

  function applyEditDraftChange(updater: (current: RegisterDraft) => RegisterDraft) {
    setManageSaveState("idle");
    setEditDraft(updater);
  }

  function openRegister(register: AssetRegisterSummary) {
    if (register.isSelected) {
      router.push(buildOpenHref(register.id, accountantShareId, registerBaseHref));
      return;
    }

    void handleSelectRegister(register, true);
  }

  function openDeleteRegisterDialog(register: AssetRegisterSummary) {
    if (registers.length <= 1) {
      setNotice({
        tone: "error",
        message: "You must keep at least one asset register.",
      });
      return;
    }

    setOpenTargetDropdownId(null);
    setDeleteCandidateRegister(register);
    setDeleteTargetRegisterId("");
  }

  function closeDeleteRegisterDialog() {
    if (removingRegisterId) return;
    setDeleteCandidateRegister(null);
    setDeleteTargetRegisterId("");
    setOpenTargetDropdownId(null);
  }

  function openExportChoiceModal(mode: ExportMode = "download") {
    setOpenTargetDropdownId(null);
    setExportMode(mode);
    setExportScope("all");
    setExportFormat("pdf");
    setExportEntityName(buildDefaultEntityName("all", registers));
    setSelectedExportRegisterIds([]);
    setExportRegisterSearch("");
    setExportStep("choice");
  }

  function openSpecificRegisterExportModal(mode: ExportMode, register: AssetRegisterSummary) {
    setOpenTargetDropdownId(null);
    setExportMode(mode);
    setExportScope("single");
    setExportFormat("pdf");
    setSelectedExportRegisterIds([register.id]);
    setExportRegisterSearch("");
    setExportEntityName(buildDefaultEntityName("single", [register]));
    setExportStep("format");
  }

  function resetExportFlowState() {
    setExportMode("download");
    setExportStep("closed");
    setExportScope("all");
    setExportFormat("pdf");
    setExportEntityName("");
    setExportRegisterSearch("");
    setSelectedExportRegisterIds([]);
  }

  function closeExportFlow() {
    if (isExporting) return;
    resetExportFlowState();
  }

  function handleSummaryPdfExport(
    scope: ExportScope,
    targetRegisters: AssetRegisterSummary[],
    options: { closeFlowOnSuccess?: boolean } = {},
  ) {
    if (isExporting) return;

    if (scope === "single" && targetRegisters.length !== 1) {
      setNotice({ tone: "error", message: "Choose one asset register to summarise." });
      return;
    }

    if (scope === "combined" && targetRegisters.length < 2) {
      setNotice({ tone: "error", message: "Select at least two asset registers to merge." });
      return;
    }

    if (!targetRegisters.length) {
      setNotice({ tone: "error", message: "No asset registers were found to summarise." });
      return;
    }

    const selectedIds = scope === "all" ? [] : targetRegisters.map((register) => register.id);
    const entityName = buildDefaultEntityName(scope, targetRegisters);
    const url = buildScopedSummaryUrl(scope, selectedIds, entityName, accountantShareId);

    setIsExporting(true);

    try {
      const didOpen = openCanonicalReportUrl(url);

      if (!didOpen) {
        throw new Error("The register summary PDF window was blocked. Allow pop-ups for Aim4price, then try again.");
      }

      setNotice({ tone: "success", message: "Register summary PDF opened." });

      if (options.closeFlowOnSuccess !== false) {
        resetExportFlowState();
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to open the register summary PDF report.",
      });
    } finally {
      window.setTimeout(() => setIsExporting(false), 700);
    }
  }

  function openAllRegistersExport() {
    if (isSummaryFlow) {
      handleSummaryPdfExport("all", registers);
      return;
    }

    setExportScope("all");
    setSelectedExportRegisterIds([]);
    setExportRegisterSearch("");
    setExportEntityName(buildDefaultEntityName("all", registers));
    setExportStep("format");
  }

  function openSingleRegisterPicker() {
    setExportScope("single");
    setSelectedExportRegisterIds([]);
    setExportRegisterSearch("");
    setExportStep("single-picker");
  }

  function openCombinedRegisterPicker() {
    setExportScope("combined");
    setSelectedExportRegisterIds([]);
    setExportRegisterSearch("");
    setExportStep("combined-picker");
  }

  function selectSingleRegisterForExport(register: AssetRegisterSummary) {
    if (isSummaryFlow) {
      handleSummaryPdfExport("single", [register]);
      return;
    }

    setExportScope("single");
    setSelectedExportRegisterIds([register.id]);
    setExportEntityName(buildDefaultEntityName("single", [register]));
    setExportStep("format");
  }

  function toggleCombinedRegister(registerId: string) {
    setSelectedExportRegisterIds((current) =>
      current.includes(registerId)
        ? current.filter((id) => id !== registerId)
        : [...current, registerId],
    );
  }

  function selectAllVisibleCombinedRegisters() {
    setSelectedExportRegisterIds((current) =>
      Array.from(new Set([...current, ...exportPickerRegisters.map((register) => register.id)])),
    );
  }

  function continueCombinedExport() {
    if (!isCombinedSelectionValid) {
      setNotice({ tone: "error", message: "Select at least two asset registers to merge." });
      return;
    }

    if (isSummaryFlow) {
      handleSummaryPdfExport("combined", selectedExportRegisters);
      return;
    }

    setExportEntityName(buildDefaultEntityName("combined", selectedExportRegisters));
    setExportStep("format");
  }

  function goBackInExportFlow() {
    if (isExporting) return;

    if (exportStep === "format") {
      setExportStep(exportScope === "single" ? "single-picker" : exportScope === "combined" ? "combined-picker" : "choice");
      return;
    }

    if (exportStep === "single-picker" || exportStep === "combined-picker") {
      setExportStep("choice");
    }
  }

  function selectedRegistersForExport(): AssetRegisterSummary[] {
    if (exportScope === "all") {
      return registers;
    }

    return selectedExportRegisterIds
      .map((registerId) => registers.find((register) => register.id === registerId) ?? null)
      .filter((register): register is AssetRegisterSummary => Boolean(register));
  }

  async function loadExportRegisterBundles(targetRegisters: AssetRegisterSummary[]): Promise<ExportRegisterBundle[]> {
    const bundles = await Promise.all(
      targetRegisters.map(async (register) => {
        const response = await fetch(registerItemsApiUrl(register.id), {
          cache: "no-store",
          credentials: "include",
        });
        const payload = await readJsonPayload(response);
        const data = (payload ?? null) as AssetRegisterItemsApiResponse | null;

        if (!response.ok || !data?.ok) {
          throw new Error(
            extractErrorMessage(payload, `Failed to load assets for ${register.businessName}.`),
          );
        }

        const items = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.assets)
            ? data.assets
            : [];

        return { register: data.register ?? register, items };
      }),
    );

    return bundles;
  }

  async function handlePrintablePdfExport(
    entityName: string,
    targetRegistersOverride?: AssetRegisterSummary[],
    exportScopeOverride?: ExportScope,
  ) {
    const activeExportScope = exportScopeOverride ?? exportScope;
    const targetRegisters = targetRegistersOverride ?? selectedRegistersForExport();

    if (activeExportScope === "single" && targetRegisters.length !== 1) {
      throw new Error("Choose one asset register to download.");
    }

    if (activeExportScope === "combined" && targetRegisters.length < 2) {
      throw new Error("Select at least two asset registers to merge.");
    }

    if (!targetRegisters.length) {
      throw new Error("No asset registers were found to export.");
    }

    const bundles = await loadExportRegisterBundles(targetRegisters);
    const allAssets = bundles.flatMap((bundle) => bundle.items);
    const reportValue = sumAssetValues(allAssets);
    const reportValueInclVat = Math.round(reportValue * 1.15);
    const reportReplacementValue = sumAssetReplacementValues(allAssets);
    const reportReplacementValueInclVat = Math.round(reportReplacementValue * 1.15);
    const reportReplacementPricedCount = countAssetsWithReplacementPrice(allAssets);
    const reportInsuredValue = sumAssetInsuredValues(allAssets);
    const reportInsuredValueInclVat = Math.round(reportInsuredValue * 1.15);
    const reportAim4priceStats = calculateAssetStats(allAssets, (asset) => methodLabel(asset.selectedMethod) !== "Manual");
    const reportInsuredStats = calculateAssetStats(allAssets, (asset) => readInsuranceStatusChoice(asset) === "yes");
    const reportFinancedStats = calculateAssetStats(allAssets, (asset) => readFinanceStatusChoice(asset) === "yes");
    const reportLicensedStats = calculateAssetStats(allAssets, (asset) => readLicenseStatusChoice(asset) === "yes");
    const rows = buildExportReportRows(bundles, activeExportScope);
    const reportName = entityName || buildDefaultEntityName(activeExportScope, targetRegisters);
    const reportTitle = buildExportReportTitle(activeExportScope);
    const didOpen = openAssetRegisterSummaryPrint({
      logoUrl: registerLogoForReport(targetRegisters),
      generatedAt: formatReportDate(new Date()),
      reportTitle,
      reportSubtitle: "Aim4price asset register",
      valueLabel: activeExportScope === "combined" ? "Merged Register Value" : "Register Value",
      assetSectionTitle: buildExportAssetSectionTitle(activeExportScope),
      emptyStateMessage: "No saved assets are currently available for this report.",
      ownerName: reportName,
      ownerMeta: buildReportOwnerMeta(activeExportScope, targetRegisters, bundles),
      intro:
        activeExportScope === "single"
          ? "Complete saved asset register snapshot."
          : `Complete saved asset register snapshot across ${targetRegisters.length} asset register${targetRegisters.length === 1 ? "" : "s"}.`,
      registerValue: money(reportValue),
      registerValueNote: `VAT excluded · ${money(reportValueInclVat)} incl. VAT · Replacement ${money(reportReplacementValue)} excl. VAT`,
      ownerRows: buildReportOwnerRows(activeExportScope, targetRegisters, reportName),
      stats: [
        {
          label: "Assets",
          value: String(rows.length),
          note: activeExportScope === "single" ? "Saved register items." : "Merged saved register items.",
        },
        { label: "Value ex VAT", value: money(reportValue), note: "Filtered report total excluding VAT." },
        { label: "Value incl VAT", value: money(reportValueInclVat), note: "Filtered report total including 15% VAT." },
        { label: "Replacement value", value: money(reportReplacementValue), note: `${reportReplacementPricedCount} assets · ${money(reportReplacementValueInclVat)} incl. VAT.` },
        { label: "Aim4price values", value: String(reportAim4priceStats.count), note: `${money(reportAim4priceStats.value)} total value.` },
        { label: "Insured assets", value: String(reportInsuredStats.count), note: `${money(reportInsuredValue)} insured value excl. VAT · ${money(reportInsuredValueInclVat)} incl. VAT.` },
        { label: "Financed assets", value: String(reportFinancedStats.count), note: `${money(reportFinancedStats.value)} marked financed.` },
        { label: "Licensed assets", value: String(reportLicensedStats.count), note: `${money(reportLicensedStats.value)} marked licensed.` },
      ],
      rows,
      footerNote:
        "Values are indicative estimates based on saved Aim4price asset-register information and available pricing inputs. Values exclude VAT unless stated otherwise. This is not a certified valuation, inspection report or guarantee of selling price. Final values remain subject to physical inspection, documents, attachments, condition, location and live market demand.",
    });

    if (!didOpen) {
      throw new Error("Unable to open the asset register PDF. Please allow pop-ups and try again.");
    }
  }

  function handleManagedRegisterSummary(register: AssetRegisterSummary) {
    if (isExporting || isLoadingManagedAssets) return;
    handleSummaryPdfExport("single", [register], { closeFlowOnSuccess: false });
  }

  async function handleExportDownload() {
    if (isExporting) return;

    const selectedIds = exportScope === "all" ? [] : selectedExportRegisterIds;
    const targetRegisters = selectedRegistersForExport();
    const entityName = exportEntityName.trim() || buildDefaultEntityName(exportScope, targetRegisters);
    const resolvedExportFormat: ExportFormat = isSummaryFlow ? "pdf" : exportFormat;

    if (exportScope === "single" && selectedIds.length !== 1) {
      setNotice({ tone: "error", message: "Choose one asset register to download." });
      return;
    }

    if (exportScope === "combined" && selectedIds.length < 2) {
      setNotice({ tone: "error", message: "Select at least two asset registers to merge." });
      return;
    }

    if (!targetRegisters.length) {
      setNotice({ tone: "error", message: "No asset registers were found to export." });
      return;
    }

    if (isSummaryFlow) {
      handleSummaryPdfExport(exportScope, targetRegisters);
      return;
    }

    setIsExporting(true);

    try {
      if (resolvedExportFormat === "pdf") {
        await handlePrintablePdfExport(entityName);
        setNotice({
          tone: "success",
          message: isSummaryFlow ? "Asset register summary PDF opened." : "Asset registers PDF opened.",
        });
      } else {
        const response = await fetch(buildExportUrl(resolvedExportFormat, exportScope, selectedIds, entityName, accountantShareId), {
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          const payload = await readJsonPayload(response);
          throw new Error(extractErrorMessage(payload, "Failed to export asset registers."));
        }

        const blob = await response.blob();
        const date = new Date().toISOString().slice(0, 10);
        const fallbackName = `aim4price-asset-registers-${slugFallback(entityName)}-${date}.xlsx`;
        const fileName = parseDownloadFileName(response, fallbackName);

        downloadBlob(blob, fileName);
        setNotice({ tone: "success", message: "Asset registers XLSX downloaded." });
      }

      resetExportFlowState();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to export asset registers.",
      });
    } finally {
      setIsExporting(false);
    }
  }

  function openCombinedDownload() {
    setOpenTargetDropdownId(null);
    setExportMode("download");
    setExportScope("all");
    setExportFormat("pdf");
    setSelectedExportRegisterIds([]);
    setExportRegisterSearch("");
    setExportEntityName("Combined Asset Registers");
    setExportStep("format");
  }

  async function openQrModal() {
    if (!managedRegister || isLoadingQrAssets) return;

    setIsQrModalOpen(true);
    setQrAssets([]);
    setSelectedQrAssetIds([]);
    setQrLayout("full-labels-10-per-page");
    setQrAssetSearch("");
    setQrError("");
    setIsLoadingQrAssets(true);

    try {
      const params = new URLSearchParams();
      if (!isManagingCombined) params.set("registerId", managedRegister.id);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(managedRegister.userId)}/qr-labels${suffix}`,
        { cache: "no-store", credentials: "include" },
      );
      const payload = (await response.json().catch(() => null)) as QrLabelsApiResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Failed to load QR labels.");
      }

      const assets = Array.isArray(payload.assets) ? payload.assets : [];
      setQrAssets(assets);
      setSelectedQrAssetIds(assets.filter((asset) => asset.hasQr).map((asset) => asset.id));
    } catch (error) {
      setQrError(error instanceof Error ? error.message : "Failed to load QR labels.");
    } finally {
      setIsLoadingQrAssets(false);
    }
  }

  function closeQrModal() {
    setIsQrModalOpen(false);
    setQrAssets([]);
    setSelectedQrAssetIds([]);
    setQrAssetSearch("");
    setQrError("");
  }

  function toggleQrAsset(assetId: string) {
    setSelectedQrAssetIds((current) => current.includes(assetId)
      ? current.filter((id) => id !== assetId)
      : [...current, assetId]);
  }

  function selectVisibleQrAssets() {
    setSelectedQrAssetIds((current) => Array.from(new Set([
      ...current,
      ...visibleQrAssets.filter((asset) => asset.hasQr).map((asset) => asset.id),
    ])));
  }

  async function generateQrLabelsPdf() {
    if (!managedRegister || isGeneratingQrPdf) return;

    const selectedIds = selectedQrAssetIds.filter((assetId) =>
      qrAssets.some((asset) => asset.id === assetId && asset.hasQr),
    );

    if (!selectedIds.length) {
      setQrError("Select at least one asset with a QR code.");
      return;
    }

    setQrError("");
    setIsGeneratingQrPdf(true);

    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(managedRegister.userId)}/qr-labels`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            layout: qrLayout,
            assetIds: selectedIds,
            registerId: isManagingCombined ? null : managedRegister.id,
            fileNameBase: managedRegister.businessName,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as QrLabelsApiResponse | null;
        throw new Error(payload?.error || "Failed to generate QR label PDF.");
      }

      const blob = await response.blob();
      const layoutName = qrLayout === "small-qr-25mm" ? "25mm" : "full-labels";
      const fallbackName = `${slugFallback(managedRegister.businessName)}-qr-codes-${layoutName}.pdf`;
      downloadBlob(blob, parseDownloadFileName(response, fallbackName));
      setNotice({
        tone: "success",
        message: `QR label PDF generated for ${selectedIds.length} asset${selectedIds.length === 1 ? "" : "s"}.`,
      });
      closeQrModal();
    } catch (error) {
      setQrError(error instanceof Error ? error.message : "Failed to generate QR label PDF.");
    } finally {
      setIsGeneratingQrPdf(false);
    }
  }

  async function uploadRegisterLogoFiles(registerId: string, files: File[]): Promise<RegisterLogoUploadResult> {
    if (!files.length) {
      return { logoUrls: [] };
    }

    if (files.length > MAX_REGISTER_LOGOS) {
      throw new Error("Choose one logo only. Uploading a new logo will replace the current logo.");
    }

    for (const file of files) {
      const fileType = String(file.type ?? "").trim().toLowerCase();

      if (!ALLOWED_REGISTER_LOGO_TYPES.has(fileType)) {
        throw new Error("Upload a JPG, PNG or WEBP logo only.");
      }

      if (!file.size) {
        throw new Error("The selected logo file is empty.");
      }

      if (file.size > MAX_REGISTER_LOGO_UPLOAD_BYTES) {
        throw new Error(`The logo must be ${formatUploadSize(MAX_REGISTER_LOGO_UPLOAD_BYTES)} or smaller.`);
      }
    }

    const formData = new FormData();
    formData.append("uploadType", "register-logo");
    formData.append("registerId", registerId);
    files.forEach((file) => formData.append("files", file));

    const uploadUrl = accountantShareId
      ? `/api/asset-register/uploads?accountantShareId=${encodeURIComponent(accountantShareId)}`
      : "/api/asset-register/uploads";
    const response = await fetch(uploadUrl, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const payload = await readJsonPayload(response);
    const data = (payload ?? null) as AssetUploadApiResponse | null;

    if (!response.ok || !data?.ok || !Array.isArray(data.uploads)) {
      throw new Error(extractErrorMessage(payload, "Failed to upload the register logo."));
    }

    const uploadedLogoUrls = data.uploads
      .map((upload) => String(upload.url ?? "").trim())
      .filter(Boolean)
      .slice(0, MAX_REGISTER_LOGOS);

    if (!uploadedLogoUrls.length) {
      throw new Error("No logo URL was returned after upload.");
    }

    return { logoUrls: uploadedLogoUrls, register: data.register };
  }

  async function handleCardLogoUpload(
    register: AssetRegisterSummary,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(event.target.files ?? []) as File[];
    event.target.value = "";

    if (!selectedFiles.length) {
      return;
    }

    if (uploadingRegisterLogoId) {
      return;
    }

    setUploadingRegisterLogoId(register.id);

    try {
      const uploadResult = await uploadRegisterLogoFiles(register.id, selectedFiles);

      if (!uploadResult.logoUrls.length) {
        return;
      }

      const updatedRegister: AssetRegisterSummary = {
        ...(uploadResult.register ?? register),
        logoUrls: normalizeLogoUrls(uploadResult.register?.logoUrls ?? uploadResult.logoUrls),
        showLogosOnRegister: true,
      };
      const logoRevision = Date.now();

      setRegisters((currentRegisters) =>
        currentRegisters.map((entry) =>
          entry.id === updatedRegister.id ? { ...entry, ...updatedRegister } : entry,
        ),
      );
      setLogoRevisions((currentRevisions) => ({
        ...currentRevisions,
        [updatedRegister.id]: logoRevision,
      }));

      if (managedRegisterId === updatedRegister.id) {
        setEditDraft(draftFromRegister(updatedRegister));
      }

      setNotice({ tone: "success", message: "Register logo uploaded and saved." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to update the register logo.",
      });
    } finally {
      setUploadingRegisterLogoId(null);
    }
  }

  async function handleCreateRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createDraft.businessName.trim()) {
      setNotice({ tone: "error", message: "Business name is required." });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(registersApiUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createDraft),
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (
        !response.ok ||
        !data?.ok ||
        !data.register ||
        !Array.isArray(data.registers)
      ) {
        throw new Error(
          extractErrorMessage(payload, "Failed to create asset register."),
        );
      }

      setRegisters(data.registers);
      setCreateDraft(emptyRegisterDraft);
      setIsCreateModalOpen(false);
      setNotice({
        tone: "success",
        message:
          "Asset register created. Open it from this page when you want to work in it.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create asset register.",
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSelectRegister(
    register: AssetRegisterSummary,
    openAfterSelect: boolean,
  ) {
    setSelectingRegisterId(register.id);

    try {
      const response = await fetch(registersApiUrl, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", registerId: register.id }),
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (
        !response.ok ||
        !data?.ok ||
        !data.register ||
        !Array.isArray(data.registers)
      ) {
        throw new Error(
          extractErrorMessage(payload, "Failed to select asset register."),
        );
      }

      setRegisters(data.registers);
      setNotice({
        tone: "success",
        message: `${data.register.businessName} selected. The Asset Register page will show only this register until you select another one here.`,
      });

      if (openAfterSelect) {
        router.push(buildOpenHref(data.register.id, accountantShareId, registerBaseHref));
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to select asset register.",
      });
    } finally {
      setSelectingRegisterId(null);
    }
  }

  async function handleUpdateRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!managedRegister) return;

    if (!editDraft.businessName.trim()) {
      setNotice({ tone: "error", message: "Business name is required." });
      return;
    }

    setManageSaveState("idle");
    setIsSavingDetails(true);

    try {
      const response = await fetch(registersApiUrl, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registerId: managedRegister.id, ...editDraft }),
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (
        !response.ok ||
        !data?.ok ||
        !data.register ||
        !Array.isArray(data.registers)
      ) {
        throw new Error(
          extractErrorMessage(payload, "Failed to update asset register."),
        );
      }

      setRegisters(data.registers);
      setEditDraft(draftFromRegister(data.register));
      setManageSaveState("saved");
      setNotice({ tone: "success", message: "Asset register details saved." });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update asset register.",
      });
    } finally {
      setIsSavingDetails(false);
    }
  }

  async function handleMoveAsset(asset: RegisterAsset) {
    if (!managedRegister) return;

    const targetRegisterId = assetMoveTargets[asset.id] ?? "";
    if (!targetRegisterId) {
      setNotice({
        tone: "error",
        message: "Choose the target asset register first.",
      });
      return;
    }

    setMovingAssetId(asset.id);
    const targetRegister = managedMoveTargets.find((target) => target.id === targetRegisterId);

    try {
      const moveApiUrl = accountantShareId
        ? `/api/accountant/registers/${encodeURIComponent(accountantShareId)}/owner-registers/move-assets`
        : "/api/asset-registers/move-assets";
      const response = await fetch(moveApiUrl, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id, targetRegisterId }),
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(extractErrorMessage(payload, "Failed to move asset."));
      }

      setManagedAssets((current) => isManagingCombined
        ? current.map((entry) => entry.id === asset.id
          ? {
              ...entry,
              registerId: targetRegisterId,
              registerName: targetRegister?.businessName ?? entry.registerName,
            }
          : entry)
        : current.filter((entry) => entry.id !== asset.id));
      setAssetMoveTargets((current) => {
        const next = { ...current };
        delete next[asset.id];
        return next;
      });
      await refreshRegisters(false);
      setNotice({
        tone: "success",
        message: targetRegister
          ? `${asset.title} moved successfully to ${targetRegister.businessName}.`
          : "Asset moved successfully.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to move asset.",
      });
    } finally {
      setMovingAssetId(null);
    }
  }

  async function handleConfirmRemoveRegister() {
    if (!deleteCandidateRegister) return;

    if (registers.length <= 1) {
      setNotice({
        tone: "error",
        message: "You must keep at least one asset register.",
      });
      return;
    }

    const targetRegisterId = deleteTargetRegisterId;
    if (deleteCandidateRegister.assetCount > 0 && !targetRegisterId) {
      setNotice({
        tone: "error",
        message:
          "Choose where the assets must move before deleting this register.",
      });
      return;
    }

    setRemovingRegisterId(deleteCandidateRegister.id);

    try {
      const response = await fetch(registersApiUrl, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registerId: deleteCandidateRegister.id,
          targetRegisterId: targetRegisterId || null,
        }),
      });
      const payload = await readJsonPayload(response);
      const data = (payload ?? null) as AssetRegistersApiResponse | null;

      if (!response.ok || !data?.ok || !Array.isArray(data.registers)) {
        throw new Error(
          extractErrorMessage(payload, "Failed to delete asset register."),
        );
      }

      setRegisters(data.registers);

      if (managedRegisterId === deleteCandidateRegister.id) {
        closeManagePanel();
      }

      setDeleteCandidateRegister(null);
      setDeleteTargetRegisterId("");
      setNotice({ tone: "success", message: "Asset register deleted." });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete asset register.",
      });
    } finally {
      setRemovingRegisterId(null);
    }
  }

  return (
    <>
      {notice ? (
        <div
          className={styles.toastViewport}
          aria-live={notice.tone === "success" ? "polite" : "assertive"}
          aria-atomic="true"
        >
          <div
            className={`${styles.toast} ${notice.tone === "success" ? styles.toastSuccess : styles.toastError}`}
            role={notice.tone === "success" ? "status" : "alert"}
          >
            <span className={styles.toastDot} aria-hidden="true" />
            <span>{notice.message}</span>
          </div>
        </div>
      ) : null}

      <main className={styles.page}>
        {showAppHeader ? <AppHeader active="none" /> : null}

        <section className={styles.shell}>
          <section className={styles.managementPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.pageTitleBlock}>
                <h1>MANAGE ASSET REGISTERS</h1>
              </div>

              <div className={styles.toolbar}>
                <label className={styles.searchWrap}>
                  <SearchIcon className={styles.searchIcon} />
                  <input
                    className={styles.searchInput}
                    value={registerSearchTerm}
                    onChange={(event) =>
                      setRegisterSearchTerm(event.target.value)
                    }
                    placeholder="Search by register, email, phone or address"
                  />
                  {registerSearchTerm.trim() ? (
                    <button
                      type="button"
                      className={styles.clearSearchButton}
                      onClick={() => setRegisterSearchTerm("")}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  ) : null}
                </label>

                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.toolbarPrimaryButton} ${styles.topAddButton}`}
                  onClick={openCreateModal}
                >
                  <PlusIcon className={styles.buttonIcon} />
                  <span>Add Asset Register</span>
                </button>

                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.toolbarPrimaryButton} ${styles.topSummaryButton}`}
                  onClick={() => openExportChoiceModal("summary")}
                  disabled={isLoading || !registers.length}
                >
                  <SummaryIcon className={styles.buttonIcon} />
                  <span>Summary</span>
                </button>

                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.toolbarPrimaryButton} ${styles.topDownloadButton}`}
                  onClick={() => openExportChoiceModal("download")}
                  disabled={isLoading || !registers.length}
                >
                  <DownloadIcon className={styles.buttonIcon} />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className={styles.emptyState}>
                <strong>Loading asset registers...</strong>
              </div>
            ) : !registers.length ? (
              <div className={styles.emptyState}>
                <strong>No asset registers found yet.</strong>
                <span>Add your first register for the account.</span>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={openCreateModal}
                >
                  <PlusIcon className={styles.buttonIcon} />
                  <span>Add Asset Register</span>
                </button>
              </div>
            ) : (
              <div className={styles.registerList}>
                {combinedRegister ? (
                  <article className={`${styles.registerCard} ${styles.combinedRegisterCard}`}>
                    <div className={styles.combinedRegisterGraphic} aria-hidden="true">
                      <SummaryIcon />
                    </div>

                    <div className={styles.registerInfo}>
                      <div className={styles.registerTitleBlock}>
                        <h2>{combinedRegister.businessName}</h2>
                        <div className={styles.registerDetails}>
                          <span>One live book containing every asset register on this account.</span>
                        </div>
                      </div>

                      <div className={styles.statGrid}>
                        <div>
                          <span>Assets</span>
                          <strong>{combinedRegister.assetCount}</strong>
                        </div>
                        <div>
                          <span>Register value</span>
                          <strong>{money(combinedRegister.totalValue)}</strong>
                        </div>
                        <div>
                          <span>Replacement value</span>
                          <strong>{money(combinedRegister.totalReplacementPrice)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className={styles.registerAside}>
                      <div className={styles.badgeStack}>
                        <span className={styles.combinedBadge}>All registers</span>
                      </div>
                      <div className={styles.unitActions}>
                        <button
                          type="button"
                          className={`${styles.unitButton} ${styles.openRegisterButton}`}
                          onClick={openCombinedRegister}
                        >
                          <OpenIcon className={styles.buttonIcon} />
                          <span>Open</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.unitButton} ${styles.manageUnitButton}`}
                          onClick={() => openManagePanel(combinedRegister)}
                          disabled={isLoadingManagedAssets}
                        >
                          <GearIcon className={styles.buttonIcon} />
                          <span>Manage</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.unitButton} ${styles.combinedDownloadButton}`}
                          onClick={openCombinedDownload}
                          disabled={isExporting}
                        >
                          <DownloadIcon className={styles.buttonIcon} />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ) : null}

                {visibleRegisters.map((register) => {
                  const isBusySelecting = selectingRegisterId === register.id;
                  const isBusyRemoving = removingRegisterId === register.id;
                  const isLogoUploading = uploadingRegisterLogoId === register.id;
                  const isLogoUploadDisabled = Boolean(uploadingRegisterLogoId) && !isLogoUploading;

                  return (
                    <article
                      key={register.id}
                      className={`${styles.registerCard} ${register.isSelected ? styles.registerCardSelected : ""}`}
                    >
                      <RegisterLogoBlock
                        register={register}
                        isUploading={isLogoUploading}
                        disabled={isLogoUploadDisabled || Boolean(removingRegisterId) || Boolean(selectingRegisterId)}
                        logoRevision={logoRevisions[register.id] ?? 0}
                        onUpload={handleCardLogoUpload}
                      />

                      <div className={styles.registerInfo}>
                        <div className={styles.registerTitleBlock}>
                          <h2>{register.businessName}</h2>
                          <div className={styles.registerDetails}>
                            <RegisterContactDetails register={register} />
                          </div>
                        </div>

                        <div className={styles.statGrid}>
                          <div>
                            <span>Assets</span>
                            <strong>{register.assetCount}</strong>
                          </div>
                          <div>
                            <span>Register value</span>
                            <strong>{money(register.totalValue)}</strong>
                          </div>
                          <div>
                            <span>Replacement value</span>
                            <strong>
                              {money(register.totalReplacementPrice)}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className={styles.registerAside}>
                        <div className={styles.badgeStack}>
                          {register.isSelected ? (
                            <span className={styles.selectedBadge}>
                              Selected
                            </span>
                          ) : null}
                          {register.isPrimary ? (
                            <span className={styles.primaryBadge}>Primary</span>
                          ) : null}
                        </div>

                        <div className={styles.unitActions}>
                          <button
                            type="button"
                            className={`${styles.unitButton} ${styles.openRegisterButton}`}
                            onClick={() => openRegister(register)}
                            disabled={isBusySelecting}
                          >
                            <OpenIcon className={styles.buttonIcon} />
                            <span>
                              {isBusySelecting ? "Opening..." : "Open"}
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.unitButton} ${styles.manageUnitButton}`}
                            onClick={() => openManagePanel(register)}
                            disabled={isLoadingManagedAssets}
                          >
                            <GearIcon className={styles.buttonIcon} />
                            <span>Manage</span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.unitButton} ${styles.deleteUnitButton}`}
                            onClick={() => openDeleteRegisterDialog(register)}
                            disabled={registers.length <= 1 || isBusyRemoving}
                          >
                            <TrashIcon className={styles.buttonIcon} />
                            <span>
                              {isBusyRemoving ? "Deleting..." : "Delete"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {!visibleRegisters.length ? (
                  <div className={styles.emptyState}>
                    <strong>No individual asset register matches the search.</strong>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setRegisterSearchTerm("")}
                    >
                      Clear search
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </section>
      </main>

      {isExportFlowOpen ? (
        <div
          className={`${styles.modalOverlay} ${styles.exportFlowOverlay}`} data-website-overlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-registers-title"
        >
          <section
            className={`${styles.modalCard} ${styles.exportFlowModal} ${
              exportStep === "choice" ? styles.exportChoiceModal : ""
            } ${
              exportStep === "format" ? styles.exportFormatModal : ""
            } ${
              exportStep === "single-picker" || exportStep === "combined-picker"
                ? styles.exportPickerModal
                : ""
            }`}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="export-registers-title">{exportTitle}</h2>
                <p className={styles.modalIntro}>{exportIntro}</p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeExportFlow}
                disabled={isExporting}
                aria-label={isSummaryFlow ? "Close summaries modal" : "Close download asset registers modal"}
              >
                ×
              </button>
            </div>

            {exportStep === "choice" ? (
              <>
                <div className={`${styles.modalBody} ${styles.exportFlowBody}`}>
                  <div className={styles.exportChoiceGrid}>
                    <button
                      type="button"
                      className={styles.exportChoiceOption}
                      onClick={openAllRegistersExport}
                      disabled={isExporting || !registers.length}
                    >
                      <span className={styles.exportChoiceGraphic}>
                        <DownloadIcon className={styles.exportChoiceIcon} />
                      </span>
                      <span className={styles.exportChoiceTitleBlock}>
                        <strong>{isSummaryFlow ? "Summary of all Asset Registers" : "Download all Asset Registers"}</strong>
                        <small>{isSummaryFlow ? "Open one PDF summary for every asset register saved on this account." : "Export every asset register saved on this account."}</small>
                      </span>
                    </button>

                    <button
                      type="button"
                      className={styles.exportChoiceOption}
                      onClick={openSingleRegisterPicker}
                      disabled={isExporting || !registers.length}
                    >
                      <span className={styles.exportChoiceGraphic}>
                        <OpenIcon className={styles.exportChoiceIcon} />
                      </span>
                      <span className={styles.exportChoiceTitleBlock}>
                        <strong>{isSummaryFlow ? "Summary of a specific Asset Register" : "Download a specific Asset Register"}</strong>
                        <small>{isSummaryFlow ? "Choose one register and open only its PDF summary." : "Choose one register and export only its saved assets."}</small>
                      </span>
                    </button>

                    {showCombinedRegister ? (
                      <button
                        type="button"
                        className={styles.exportChoiceOption}
                        onClick={openCombinedRegisterPicker}
                        disabled={isExporting || registers.length < 2}
                      >
                        <span className={styles.exportChoiceGraphic}>
                          <PlusIcon className={styles.exportChoiceIcon} />
                        </span>
                        <span className={styles.exportChoiceTitleBlock}>
                          <strong>Merge specific Asset Registers</strong>
                          <small>{isSummaryFlow ? "Select two or more registers and merge them into one PDF summary." : "Select two or more registers and merge them into one export."}</small>
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className={`${styles.modalFooter} ${styles.exportModalFooter}`}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={closeExportFlow}
                    disabled={isExporting}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : null}

            {exportStep === "single-picker" || exportStep === "combined-picker" ? (
              <>
                <div className={`${styles.modalBody} ${styles.exportFlowBody} ${styles.registerPickerBody}`}>
                  <div className={styles.registerPickerToolbar}>
                    <label className={styles.exportSearchWrap}>
                      <SearchIcon className={styles.searchIcon} />
                      <input
                        value={exportRegisterSearch}
                        onChange={(event) => setExportRegisterSearch(event.target.value)}
                        placeholder="Search asset registers..."
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setExportRegisterSearch("")}
                      disabled={!exportRegisterSearch.trim() || isExporting}
                    >
                      Clear
                    </button>
                  </div>

                  {exportStep === "combined-picker" ? (
                    <div className={styles.registerPickerQuickActions}>
                      <span className={styles.selectedCount}>
                        {selectedExportRegisterCount} selected
                      </span>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={selectAllVisibleCombinedRegisters}
                        disabled={!exportPickerRegisters.length || isExporting}
                      >
                        Select all visible
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setSelectedExportRegisterIds([])}
                        disabled={!selectedExportRegisterCount || isExporting}
                      >
                        Clear selected
                      </button>
                    </div>
                  ) : null}

                  <div className={styles.registerPickerList}>
                    {exportPickerRegisters.length ? (
                      exportPickerRegisters.map((register) => {
                        const isSelected = selectedExportRegisterIds.includes(register.id);

                        return (
                          <button
                            key={register.id}
                            type="button"
                            className={`${styles.registerPickerRow} ${
                              isSelected ? styles.registerPickerRowSelected : ""
                            }`}
                            onClick={() =>
                              exportStep === "single-picker"
                                ? selectSingleRegisterForExport(register)
                                : toggleCombinedRegister(register.id)
                            }
                            aria-pressed={exportStep === "combined-picker" ? isSelected : undefined}
                            disabled={isExporting}
                          >
                            {exportStep === "combined-picker" ? (
                              <span className={styles.registerPickerCheckbox} aria-hidden="true">
                                {isSelected ? "✓" : ""}
                              </span>
                            ) : null}

                            <span className={styles.registerPickerInfo}>
                              <strong>{register.businessName}</strong>
                              <RegisterContactDetails register={register} className={styles.registerPickerContact} />
                              <small>
                                {register.assetCount} asset{register.assetCount === 1 ? "" : "s"}
                              </small>
                            </span>

                            <span className={styles.registerPickerValue}>
                              <strong>{money(register.totalValue)}</strong>
                              <small>register value</small>
                              <strong>{money(register.totalReplacementPrice)}</strong>
                              <small>replacement value</small>
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className={styles.registerPickerNoResults}>
                        <strong>No asset registers match the search.</strong>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => setExportRegisterSearch("")}
                          disabled={isExporting}
                        >
                          Clear search
                        </button>
                      </div>
                    )}
                  </div>

                  {exportStep === "combined-picker" && selectedExportRegisterCount > 0 && selectedExportRegisterCount < 2 ? (
                    <p className={styles.exportValidation}>
                      Select at least two asset registers before continuing.
                    </p>
                  ) : null}
                </div>

                <div className={`${styles.modalFooter} ${styles.exportModalFooter}`}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={goBackInExportFlow}
                    disabled={isExporting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={closeExportFlow}
                    disabled={isExporting}
                  >
                    Cancel
                  </button>
                  {exportStep === "combined-picker" ? (
                    <button
                      type="button"
                      className={`${styles.primaryButton} ${styles.exportNextButton}`}
                      onClick={continueCombinedExport}
                      disabled={!isCombinedSelectionValid || isExporting}
                    >
                      {isSummaryFlow
                        ? isExporting
                          ? "Preparing summary..."
                          : "Open PDF summary"
                        : "Next"}
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

            {exportStep === "format" ? (
              <>
                <div className={`${styles.modalBody} ${styles.exportSetupBody}`}>
                  <label className={`${styles.field} ${styles.exportNameField}`}>
                    <span>{isSummaryFlow ? "Summary report name" : "Entity / report name"}</span>
                    <input
                      value={exportEntityName}
                      onChange={(event) => setExportEntityName(event.target.value)}
                      placeholder={isSummaryFlow ? "Enter the summary report name" : "Enter the entity or report name"}
                      disabled={isExporting}
                    />
                  </label>

                  <div className={`${styles.exportFormatGrid} ${isSummaryFlow ? styles.exportFormatGridSingle : ""}`}>
                    <button
                      type="button"
                      className={`${styles.exportOption} ${
                        exportFormat === "pdf" ? styles.exportOptionActive : ""
                      }`}
                      onClick={() => setExportFormat("pdf")}
                      disabled={isExporting}
                    >
                      <span className={styles.exportGraphic}>
                        <img
                          src="/brand/pdf.png"
                          alt=""
                          className={styles.exportGraphicImage}
                        />
                      </span>
                      <span className={styles.exportOptionTitleBlock}>
                        <strong>{isSummaryFlow ? "PDF summary report" : "PDF report"}</strong>
                        <small>
                          {isSummaryFlow
                            ? "Open a clear PDF summary for clients, banks or insurance partners."
                            : "Choose a clear PDF report for clients, banks or insurance partners."}
                        </small>
                      </span>
                    </button>

                    {!isSummaryFlow ? (
                      <button
                        type="button"
                        className={`${styles.exportOption} ${
                          exportFormat === "xlsx" ? styles.exportOptionActive : ""
                        }`}
                        onClick={() => setExportFormat("xlsx")}
                        disabled={isExporting}
                      >
                        <span className={styles.exportGraphic}>
                          <img
                            src="/brand/sheet.png"
                            alt=""
                            className={styles.exportGraphicImage}
                          />
                        </span>
                        <span className={styles.exportOptionTitleBlock}>
                          <strong>XLSX workbook</strong>
                          <small>Download all register rows in an Excel-ready workbook.</small>
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className={`${styles.modalFooter} ${styles.exportModalFooter}`}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={goBackInExportFlow}
                    disabled={isExporting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={closeExportFlow}
                    disabled={isExporting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`${styles.primaryButton} ${styles.exportConfirmButton}`}
                    onClick={() => void handleExportDownload()}
                    disabled={isExporting}
                  >
                    <DownloadIcon className={styles.buttonIcon} />
                    <span>
                      {isExporting
                        ? isSummaryFlow
                          ? "Preparing summary..."
                          : "Preparing export..."
                        : isSummaryFlow
                          ? "Open PDF summary"
                          : exportFormat === "pdf"
                            ? "Open PDF report"
                            : "Download Excel"}
                    </span>
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </div>
      ) : null}

      {managedRegister ? (
        <div
          className={`${styles.modalOverlay} ${styles.manageModalOverlay}`} data-website-overlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-register-title"
        >
          <section className={`${styles.modalCard} ${styles.manageModalCard}`}>
            <div className={styles.modalHeader}>
              <div>
                <h2 id="manage-register-title">
                  {managedRegister.businessName}
                </h2>
                <p className={styles.modalIntro}>
                  {isManagingCombined
                    ? "Review every asset and move equipment between the saved asset registers on this account."
                    : "Update register details or move assets from this register to another register on the same account."}
                </p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeManagePanel}
                disabled={isSavingDetails || Boolean(movingAssetId)}
                aria-label="Close manage asset register modal"
              >
                ×
              </button>
            </div>

            <div className={styles.manageModalScrollArea}>
              <div className={styles.manageActionPanel}>
                <div className={`${styles.manageActionGrid} ${isManagingCombined ? styles.manageActionGridCombined : ""} ${accountantShareId && !isManagingCombined ? styles.manageActionGridAccountant : ""}`}>
                  {!isManagingCombined ? (
                    <button
                      type="button"
                      className={`${styles.manageActionButton} ${styles.manageEditAction}`}
                      onClick={openManagedEditModal}
                      disabled={isSavingDetails || Boolean(movingAssetId)}
                    >
                      <EditIcon className={styles.manageActionIcon} />
                      <span>Edit</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className={`${styles.manageActionButton} ${styles.manageSummaryAction}`}
                    onClick={() => isManagingCombined
                      ? void handleSummaryPdfExport("all", registers, { closeFlowOnSuccess: false })
                      : void handleManagedRegisterSummary(managedRegister)}
                    disabled={isExporting || isLoadingManagedAssets}
                  >
                    <SummaryIcon className={styles.manageActionIcon} />
                    <span>Summary</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.manageActionButton} ${styles.manageDownloadAction}`}
                    onClick={() => isManagingCombined
                      ? openCombinedDownload()
                      : openSpecificRegisterExportModal("download", managedRegister)}
                    disabled={isExporting || isLoadingManagedAssets}
                  >
                    <DownloadIcon className={styles.manageActionIcon} />
                    <span>Download</span>
                  </button>

                  {!accountantShareId ? <button
                    type="button"
                    className={`${styles.manageActionButton} ${styles.manageQrAction}`}
                    onClick={() => void openQrModal()}
                    disabled={isLoadingQrAssets || isLoadingManagedAssets}
                  >
                    <QrCodeIcon className={styles.manageActionIcon} />
                    <span>QR Codes</span>
                  </button> : null}
                </div>

                <label className={`${styles.searchWrap} ${styles.manageAssetSearchWrap}`}>
                  <SearchIcon className={styles.searchIcon} />
                  <input
                    className={styles.searchInput}
                    value={managedAssetSearchTerm}
                    onChange={(event) => setManagedAssetSearchTerm(event.target.value)}
                    placeholder="Search assets..."
                  />
                  {managedAssetSearchTerm.trim() ? (
                    <button
                      type="button"
                      className={styles.clearSearchButton}
                      onClick={() => setManagedAssetSearchTerm("")}
                      aria-label="Clear asset search"
                    >
                      ×
                    </button>
                  ) : null}
                </label>
              </div>

              <div className={styles.assetMovePanel}>
                {isLoadingManagedAssets ? (
                  <p className={styles.loading}>Loading assets...</p>
                ) : managedAssets.length ? (
                  visibleManagedAssets.length ? (
                    <div className={styles.assetMoveList}>
                      {visibleManagedAssets.map((asset) => (
                      <div key={asset.id} className={styles.assetMoveRow}>
                        <div className={styles.assetMoveCopy}>
                          <strong>{asset.title}</strong>
                          <span>{compactAssetMeta(asset)}</span>
                          {isManagingCombined ? (
                            <small className={styles.assetSourceRegister}>{asset.registerName || "Asset Register"}</small>
                          ) : null}
                          <small>{money(asset.value)} current value</small>
                        </div>

                        <div className={styles.assetMoveControls}>
                          <RegisterTargetDropdown
                            dropdownId={`move-${asset.id}`}
                            value={assetMoveTargets[asset.id] ?? ""}
                            targets={isManagingCombined
                              ? registers.filter((register) => register.id !== asset.registerId)
                              : managedMoveTargets}
                            placeholder="Choose target register"
                            disabled={
                              (isManagingCombined
                                ? registers.filter((register) => register.id !== asset.registerId).length === 0
                                : !managedMoveTargets.length) ||
                              movingAssetId === asset.id
                            }
                            openDropdownId={openTargetDropdownId}
                            onOpenDropdownChange={setOpenTargetDropdownId}
                            onChange={(value) =>
                              setAssetMoveTargets((current) => ({
                                ...current,
                                [asset.id]: value,
                              }))
                            }
                          />

                          <button
                            type="button"
                            className={
                              assetMoveTargets[asset.id] && movingAssetId !== asset.id
                                ? `${styles.primaryButton} ${styles.assetMoveReadyButton}`
                                : styles.secondaryButton
                            }
                            onClick={() => handleMoveAsset(asset)}
                            disabled={
                              !assetMoveTargets[asset.id] ||
                              movingAssetId === asset.id
                            }
                          >
                            {movingAssetId === asset.id ? "Moving..." : "Move"}
                          </button>
                        </div>
                      </div>
                    ))}
                    </div>
                  ) : (
                    <p className={styles.loading}>
                      No assets match the search in this register.
                    </p>
                  )
                ) : (
                  <p className={styles.loading}>
                    No assets saved in this register yet.
                  </p>
                )}

                {(isManagingCombined ? registers.length <= 1 : !managedMoveTargets.length) ? (
                  <p className={styles.muted}>
                    Create another asset register before moving assets.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isQrModalOpen && managedRegister ? (
        <div
          className={`${styles.modalOverlay} ${styles.qrLabelsOverlay}`} data-website-overlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-labels-title"
        >
          <section
            className={`${styles.modalCard} ${styles.qrLabelsModal}`}
            data-asset-choice-surface="true"
            data-asset-choice-modal="true"
          >
            <div className={styles.modalHeader} data-asset-choice-header="true">
              <div>
                <h2 id="qr-labels-title">QR Codes</h2>
                <p className={styles.modalIntro}>
                  Choose the label size and assets for {managedRegister.businessName}.
                </p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeQrModal}
                disabled={isGeneratingQrPdf}
                aria-label="Close QR Codes modal"
              >
                ×
              </button>
            </div>

            <div className={`${styles.modalBody} ${styles.qrLabelsBody}`}>
              <div className={styles.exportFormatGrid} aria-label="QR label size">
                <button
                  type="button"
                  className={`${styles.exportOption} ${qrLayout === "small-qr-25mm" ? styles.exportOptionActive : ""}`}
                  onClick={() => setQrLayout("small-qr-25mm")}
                  disabled={isGeneratingQrPdf}
                >
                  <span className={`${styles.exportGraphic} ${styles.qrExportGraphic}`}>
                    <QrCodeIcon className={styles.qrExportIcon} />
                  </span>
                  <span className={styles.exportOptionTitleBlock}>
                    <strong>25 mm Small Labels</strong>
                    <small>Compact QR stickers with the asset name above.</small>
                  </span>
                </button>

                <button
                  type="button"
                  className={`${styles.exportOption} ${qrLayout === "full-labels-10-per-page" ? styles.exportOptionActive : ""}`}
                  onClick={() => setQrLayout("full-labels-10-per-page")}
                  disabled={isGeneratingQrPdf}
                >
                  <span className={`${styles.exportGraphic} ${styles.qrExportGraphic}`}>
                    <QrCodeIcon className={styles.qrExportIcon} />
                  </span>
                  <span className={styles.exportOptionTitleBlock}>
                    <strong>Full Labels</strong>
                    <small>Ten larger Aim4price plate labels per A4 page.</small>
                  </span>
                </button>
              </div>

              <div className={styles.qrAssetToolbar} data-asset-choice-toolbar="true">
                <label className={`${styles.searchWrap} ${styles.qrAssetSearchWrap}`}>
                  <SearchIcon className={styles.searchIcon} />
                  <input
                    className={styles.searchInput}
                    value={qrAssetSearch}
                    onChange={(event) => setQrAssetSearch(event.target.value)}
                    placeholder="Search assets, QR codes or registers..."
                    disabled={isLoadingQrAssets || isGeneratingQrPdf}
                  />
                </label>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={selectVisibleQrAssets}
                  disabled={isLoadingQrAssets || isGeneratingQrPdf || !visibleQrAssets.some((asset) => asset.hasQr)}
                >
                  Select all visible
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setSelectedQrAssetIds([])}
                  disabled={isGeneratingQrPdf || !selectedQrAssetIds.length}
                >
                  Clear
                </button>
              </div>

              <div className={styles.qrAssetList} data-asset-choice-list="true">
                {isLoadingQrAssets ? (
                  <div className={styles.qrAssetEmpty}>Loading QR Codes...</div>
                ) : visibleQrAssets.length ? (
                  visibleQrAssets.map((asset) => {
                    const isSelected = selectedQrAssetIds.includes(asset.id);
                    return (
                      <label
                        key={asset.id}
                        className={`${styles.qrAssetRow} ${isSelected ? styles.qrAssetRowSelected : ""} ${!asset.hasQr ? styles.qrAssetRowDisabled : ""}`}
                        data-asset-choice-row="true"
                        data-asset-choice-selected={isSelected ? "true" : undefined}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleQrAsset(asset.id)}
                          disabled={!asset.hasQr || isGeneratingQrPdf}
                        />
                        <span className={styles.qrAssetCopy} data-asset-choice-copy="true">
                          <strong>{asset.title}</strong>
                          <small data-asset-choice-meta="true">{asset.registerName} · {asset.plateLabel || "QR code not available"}</small>
                        </span>
                        <span className={styles.qrAssetStatus} data-asset-choice-secondary="true">
                          {asset.hasQr ? "Ready" : "Unavailable"}
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div className={styles.qrAssetEmpty}>No assets match this search.</div>
                )}
              </div>

              {qrError ? <p className={styles.exportValidation}>{qrError}</p> : null}
            </div>

            <div className={`${styles.modalFooter} ${styles.exportModalFooter}`} data-asset-choice-footer="true">
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeQrModal}
                disabled={isGeneratingQrPdf}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void generateQrLabelsPdf()}
                disabled={isLoadingQrAssets || isGeneratingQrPdf || !selectedQrAssetIds.length}
              >
                <DownloadIcon className={styles.buttonIcon} />
                <span>{isGeneratingQrPdf ? "Preparing PDF..." : `Download ${selectedQrAssetIds.length || ""} PDF`}</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {managedRegister && isEditDetailsModalOpen ? (
        <div
          className={`${styles.modalOverlay} ${styles.editDetailsOverlay}`} data-website-overlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-register-title"
        >
          <form
            className={`${styles.modalCard} ${styles.editDetailsModalCard}`}
            onSubmit={handleUpdateRegister}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="edit-register-title">Edit asset register</h2>
                <p className={styles.modalIntro}>
                  Update the details shown on the register card and asset register reports.
                </p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeManagedEditModal}
                disabled={isSavingDetails}
                aria-label="Close edit asset register modal"
              >
                ×
              </button>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Business name</span>
                <input
                  value={editDraft.businessName}
                  onChange={(event) =>
                    applyEditDraftChange((current) => ({
                      ...current,
                      businessName: event.target.value,
                    }))
                  }
                  placeholder="Business name"
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={editDraft.email}
                  onChange={(event) =>
                    applyEditDraftChange((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="Email"
                />
              </label>

              <label className={styles.field}>
                <span>Phone</span>
                <input
                  type="tel"
                  value={editDraft.phone}
                  onChange={(event) =>
                    applyEditDraftChange((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="Phone"
                />
              </label>

              <label className={`${styles.field} ${styles.fullField}`}>
                <span>Address</span>
                <textarea
                  value={editDraft.addressLine1}
                  onChange={(event) =>
                    applyEditDraftChange((current) => ({
                      ...current,
                      addressLine1: event.target.value,
                    }))
                  }
                  placeholder="Address"
                />
              </label>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={closeManagedEditModal}
                disabled={isSavingDetails}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`${styles.modalPrimaryButton} ${manageSaveState === "saved" ? styles.manageSaveButtonSaved : ""}`}
                disabled={isSavingDetails}
              >
                {isSavingDetails ? "Saving..." : manageSaveState === "saved" ? "Saved" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isCreateModalOpen ? (
        <div
          className={styles.modalOverlay} data-website-overlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-register-title"
        >
          <form
            className={`${styles.modalCard} ${styles.createModalCard}`}
            onSubmit={handleCreateRegister}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="add-register-title">Create a new asset register</h2>
                <p className={styles.modalIntro}>
                  Add the business details for the register. Only the business
                  name is required. Logos are added from the register card after creation.
                </p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeCreateModal}
                disabled={isCreating}
                aria-label="Close add asset register modal"
              >
                ×
              </button>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Business name</span>
                <input
                  value={createDraft.businessName}
                  onChange={(event) =>
                    setCreateDraft((current) => ({
                      ...current,
                      businessName: event.target.value,
                    }))
                  }
                  placeholder="Example: Bashan Boerdery Pty Ltd"
                  required
                />
              </label>

              <label className={styles.field}>
                <span>Email</span>
                <input
                  type="email"
                  value={createDraft.email}
                  onChange={(event) =>
                    setCreateDraft((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="accounts@example.co.za"
                />
              </label>

              <label className={styles.field}>
                <span>Phone</span>
                <input
                  type="tel"
                  value={createDraft.phone}
                  onChange={(event) =>
                    setCreateDraft((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="082 000 0000"
                />
              </label>

              <label className={`${styles.field} ${styles.fullField}`}>
                <span>Address</span>
                <textarea
                  value={createDraft.addressLine1}
                  onChange={(event) =>
                    setCreateDraft((current) => ({
                      ...current,
                      addressLine1: event.target.value,
                    }))
                  }
                  placeholder="Farm, town, province"
                />
              </label>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={closeCreateModal}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.modalPrimaryButton}
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create register"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteCandidateRegister ? (
        <div
          className={`${styles.modalOverlay} ${styles.deleteConfirmOverlay}`} data-website-overlay
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-register-title"
          aria-describedby="delete-register-copy"
        >
          <div className={styles.deleteConfirmModal}>
            <button
              type="button"
              className={styles.deleteConfirmCloseButton}
              onClick={closeDeleteRegisterDialog}
              aria-label="Close delete confirmation"
              disabled={removingRegisterId === deleteCandidateRegister.id}
            >
              ×
            </button>

            <div className={styles.deleteConfirmContent}>
              <h3 id="delete-register-title">Are you sure you want to delete this?</h3>
              <p id="delete-register-copy">
                This removes{" "}
                <strong>{deleteCandidateRegister.businessName}</strong> from
                your account. Assets can be moved to another register before the
                register is deleted.
              </p>

              <div className={styles.deleteConfirmAsset}>
                <span>Selected register</span>
                <strong>{deleteCandidateRegister.businessName}</strong>
                <small>
                  {deleteCandidateRegister.assetCount} asset
                  {deleteCandidateRegister.assetCount === 1 ? "" : "s"} ·{" "}
                  {money(deleteCandidateRegister.totalValue)} register value
                </small>
              </div>

              {deleteCandidateRegister.assetCount > 0 ? (
                <div className={`${styles.field} ${styles.deleteMoveField}`}>
                  <span>Move assets to</span>
                  <RegisterTargetDropdown
                    dropdownId={`delete-${deleteCandidateRegister.id}`}
                    value={deleteTargetRegisterId}
                    targets={deleteMoveTargets}
                    placeholder="Choose target register"
                    disabled={removingRegisterId === deleteCandidateRegister.id}
                    openDropdownId={openTargetDropdownId}
                    onOpenDropdownChange={setOpenTargetDropdownId}
                    onChange={setDeleteTargetRegisterId}
                  />
                </div>
              ) : null}

              <div className={styles.deleteConfirmActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={closeDeleteRegisterDialog}
                  disabled={removingRegisterId === deleteCandidateRegister.id}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.deleteConfirmButton}`}
                  onClick={() => void handleConfirmRemoveRegister()}
                  disabled={
                    removingRegisterId === deleteCandidateRegister.id ||
                    (deleteCandidateRegister.assetCount > 0 &&
                      !deleteTargetRegisterId)
                  }
                >
                  <span>
                    {removingRegisterId === deleteCandidateRegister.id
                      ? "Deleting..."
                      : "Yes, delete register"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

