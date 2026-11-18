import {resolveAssetUsage, formatResolvedAssetUsage} from '../../../lib/asset-usage';
import { resolveOwnerWorkspaceContext, getWorkspaceAssetIds } from '../../../lib/owner-workspace-access';
import {getDb} from '../../../lib/db';
import {ensureLocationHistorySchema} from '../../../lib/asset-location-history-db';
import {latestTrackingPositions} from '../../../lib/asset-tracking';
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
type AssetMapUsageMetric = "hours" | "km" | "percentage" | "not_applicable" | null;

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
  fixedLocation?: boolean;
  hasSavedPins?: boolean;
  hasPastRoutes?: boolean;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  updatedAtIso: string;
  photos: string[];
  trackingStatus?: string;
  lastTrackingContactAtIso?: string | null;
  lastTrackedAtIso?: string;
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

function readUsageMetric(item: AssetRegisterItem): AssetMapUsageMetric {
  return resolveAssetUsage(item).metric;
}

function formatUsageDisplay(item: AssetRegisterItem): string {
  const usage = resolveAssetUsage(item);
  return usage.metric === 'not_applicable' ? '' : formatResolvedAssetUsage(usage, 'Usage unknown');
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
    fixedLocation: item.fixedLocation,
    lastKnownLat: item.lastKnownLat,
    lastKnownLng: item.lastKnownLng,
    lastKnownLocationText: item.lastKnownLocationText,
    updatedAtIso: item.updatedAtIso,
    photos: Array.isArray(item.photos)
      ? item.photos.filter((photo) => typeof photo === "string" && photo.trim())
      : [],
  };
}

export async function GET(request: Request) {
  const resolved = await resolveOwnerWorkspaceContext(request);
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;
  const session = { user: { id: workspace.ownerUserId } };
  const allowedIds = await getWorkspaceAssetIds(workspace);

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
      items.filter(item => !allowedIds || allowedIds.has(item.id)).map((item) => mapAssetForMap(item, register)),
    );
    const byAsset=await latestTrackingPositions(session.user.id);
    const fixedAssets = assets.filter(asset => asset.fixedLocation);
    if (fixedAssets.length && !workspace.team) {
      await ensureLocationHistorySchema();
      const {rows} = await getDb().query(`SELECT a.id,
        EXISTS (SELECT 1 FROM public.asset_scan_events e WHERE e.asset_id=a.id AND e.location_history_deleted_at IS NULL
          AND e.latitude BETWEEN -90 AND 90 AND e.longitude BETWEEN -180 AND 180) AS pins,
        EXISTS (SELECT 1 FROM public.asset_tracking_devices d JOIN public.asset_tracking_points p ON p.device_id=d.id
          WHERE d.asset_id=a.id AND d.owner_id=a.user_id AND p.history_deleted_at IS NULL AND p.accuracy<=50) AS routes
        FROM public.asset_register_items a WHERE a.user_id=$1 AND a.id=ANY($2::uuid[])`,
        [session.user.id,fixedAssets.map(asset=>asset.id)]);
      const history = new Map(rows.map(row=>[row.id,row]));
      for (const asset of fixedAssets) {
        asset.hasSavedPins = history.get(asset.id)?.pins === true;
        asset.hasPastRoutes = history.get(asset.id)?.routes === true;
      }
    }
    for(const asset of assets){
      const point=byAsset.get(asset.id);if(!point)continue;
      asset.lastTrackingContactAtIso=point.last_seen_at?new Date(point.last_seen_at).toISOString():null;
      asset.trackingStatus=!point.connected_device_id?'Phone disconnected':!point.last_seen_at?'Waiting':!point.active?'Deactivated':Date.now()-new Date(point.last_seen_at).getTime()>12*60000?'Offline':point.diagnostics?.recording===0?'Open phone to resume':!point.captured_at||Date.now()-new Date(point.captured_at).getTime()>12*60000?'No recent GPS':point.motion==='stationary'?'Stopped':'Moving';
      if(point.captured_at){asset.lastTrackedAtIso=new Date(point.captured_at).toISOString();
        if(!asset.lastScannedAtIso||Date.parse(asset.lastTrackedAtIso)>=Date.parse(asset.lastScannedAtIso)){
          asset.lastKnownLat=Number(point.latitude);asset.lastKnownLng=Number(point.longitude);asset.lastKnownLocationText='Tracking phone';
          asset.updatedAtIso=asset.lastTrackedAtIso;
        }
      }
    }
    if (workspace.team) for (const asset of assets) {
      if (!workspace.team.grant.permissions.viewValues) { asset.value = 0; asset.replacementPriceExVat = null; asset.financeStatus = 'unknown'; asset.insuranceStatus = 'unknown'; }
      if (!workspace.team.grant.permissions.viewPhotos) asset.photos = [];
    }
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
      ...registerContexts.filter(register => !allowedIds || assets.some(asset => asset.registerId === register.id)).map((register) => ({
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
