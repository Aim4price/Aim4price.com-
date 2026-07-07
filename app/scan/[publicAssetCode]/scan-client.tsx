"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import styles from "./page.module.css";
import {
  createOfflineClientEventId,
  enqueueOfflineMutation,
  getOfflineMutationCount,
  isOfflineNetworkError,
  syncOfflineMutations,
} from "../../../lib/offline-mutation-queue";

type NoticeTone = "success" | "error";
type PendingSyncKind = "asset-scan-update";
type EditorKey = "usage" | "service" | "photos" | "notes";
type LocationState = "idle" | "capturing" | "ready" | "error";
type ScanAssetUsageMode = "hours" | "percent" | "km" | "none";
type ScanAssetStatusChoice = "yes" | "no" | "unknown" | "not_applicable";
type ServiceMode = "" | "checked" | "serviced" | "repaired";
type PartnerType = "dealer" | "finance" | "insurance";
type ShareLeadStep = "message" | "consent" | null;
type ScanAccessResponseMode = "owner_session" | "scan_pin" | "field_manager";

type PartnerDirectoryEntry = {
  userId: string;
  partnerType: PartnerType;
  displayName: string;
  businessName: string;
  phone: string;
  email: string;
  province: string;
  townCity: string;
  addressLine1: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  description: string;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusKm: number | null;
  brandFocus: string;
  services: string;
};

type ScanSafeAsset = {
  id: string;
  userId: string;
  publicAssetCode: string;
  plateLabel: string;
  qrStatus: string;
  title: string;
  kind: string;
  equipmentFamilyKey: string;
  equipmentFamilyLabel: string;
  serialNumber: string;
  financeStatus: ScanAssetStatusChoice;
  insuranceStatus: ScanAssetStatusChoice;
  licenseStatus: ScanAssetStatusChoice;
  licenseRegistrationNumber: string;
  hours: number | null;
  usageMode: ScanAssetUsageMode;
  usageMetric: "hours" | "km";
  lifeWorkedPercent: number | null;
  isPropelled: boolean;
  canUpdateFuel: boolean;
  condition: string;
  note: string;
  photos: string[];
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

type ScanAssetResponse = {
  ok: boolean;
  asset?: ScanSafeAsset;
  accessMode?: ScanAccessResponseMode;
  fieldManagerDisplayName?: string | null;
  pinRequired?: boolean;
  preview?: boolean;
  error?: string;
};

type ScanAuthResponse = {
  ok: boolean;
  error?: string;
};

type ScanUploadedPhoto = {
  uploadId: string;
  url: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

type ScanUploadResponse = {
  ok: boolean;
  uploads?: ScanUploadedPhoto[];
  error?: string;
  pinRequired?: boolean;
};

type SaveScanEventResponse = {
  ok: boolean;
  asset?: ScanSafeAsset;
  error?: string;
  pinRequired?: boolean;
};

type PartnerDirectoryApiResponse = {
  ok: boolean;
  partners?: PartnerDirectoryEntry[];
  error?: string;
  pinRequired?: boolean;
};

type DealerShareLeadResponse = {
  ok: boolean;
  lead?: unknown;
  error?: string;
  pinRequired?: boolean;
};

type DraftState = {
  hours: string;
  note: string;
  latitude: string;
  longitude: string;
  photoUrls: string[];
  serviceMode: ServiceMode;
  checkedItems: string[];
  servicedItems: string[];
  repairDetails: string;
  serviceCompany: string;
  mechanicName: string;
};

type PendingScanUpdate = {
  hours: string;
  notes: string[];
  photoUrls: string[];
  latitude: string;
  longitude: string;
  gpsAccuracyMeters: string;
  clientCapturedAt: string;
  clientEventId: string;
  hasUsage: boolean;
  hasService: boolean;
  hasPhotos: boolean;
  hasNotes: boolean;
};

type PersistPendingScanUpdateResult = {
  asset: ScanSafeAsset;
  syncedToServer: boolean;
};

const MAX_QR_PHOTOS = 12;
const MAX_SHARE_PHOTOS = 3;
const QR_PHOTO_MAX_DIMENSION = 1400;
const QR_PHOTO_JPEG_QUALITY = 0.72;
const QR_PHOTO_SKIP_COMPRESSION_BYTES = 700 * 1024;
const SCAN_LEAFLET_SCRIPT_ID = "aim4price-scan-leaflet-script";
const SCAN_LEAFLET_CSS_ID = "aim4price-scan-leaflet-css";
const SCAN_LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const SCAN_LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const DEFAULT_DEALER_MAP_CENTER: [number, number] = [-29, 24];
const DEFAULT_DEALER_MAP_ZOOM = 5;
let scanLeafletLoaderPromise: Promise<any> | null = null;

type ServiceOption = {
  label: string;
  description: string;
};

type AssetServiceProfile = "propelled" | "implement";

const PROPELLED_CHECKED_OPTIONS: readonly ServiceOption[] = [
  { label: "Oil level", description: "Dipstick / sight glass checked." },
  {
    label: "Tyres",
    description: "Pressure, tread and visible damage checked.",
  },
  {
    label: "Safety",
    description: "Guards, warning lights and obvious risks checked.",
  },
  { label: "Lights", description: "Working lights and indicators checked." },
  { label: "Brakes", description: "Brake response and pedal feel checked." },
  { label: "Hydraulics", description: "Hoses, rams and leaks checked." },
  { label: "Battery", description: "Terminals, charge and mounting checked." },
  { label: "Coolant", description: "Level and visible leaks checked." },
  { label: "Belts", description: "Wear, cracks and tension checked." },
  {
    label: "Leaks",
    description: "Oil, diesel, coolant and hydraulic leaks checked.",
  },
] as const;

const PROPELLED_SERVICED_OPTIONS: readonly ServiceOption[] = [
  {
    label: "Changed engine oil",
    description: "Engine oil drained and replaced.",
  },
  {
    label: "Changed hydraulic oil",
    description: "Hydraulic oil serviced or replaced.",
  },
  {
    label: "Changed air filters",
    description: "Air filter elements cleaned or replaced.",
  },
  { label: "Changed oil filters", description: "Engine oil filters replaced." },
  {
    label: "Changed diesel filters",
    description: "Fuel / diesel filters replaced.",
  },
  { label: "Greased machine", description: "Grease points completed." },
  { label: "Coolant top-up", description: "Coolant topped up or replaced." },
  { label: "Replaced belts", description: "Worn belts replaced or adjusted." },
  {
    label: "Tyre repair",
    description: "Tyre puncture, valve or pressure repair.",
  },
  {
    label: "Battery service",
    description: "Battery serviced, replaced or terminals cleaned.",
  },
] as const;

const IMPLEMENT_CHECKED_OPTIONS: readonly ServiceOption[] = [
  {
    label: "Nuts and bolts",
    description: "Loose, missing or damaged bolts checked.",
  },
  {
    label: "Pins and bushes",
    description: "Wear, play and locking clips checked.",
  },
  {
    label: "Frame and welds",
    description: "Cracks, bent sections and welds checked.",
  },
  {
    label: "Hitch / drawbar",
    description: "Hitch points, hooks and drawbar checked.",
  },
  {
    label: "Hydraulic hoses",
    description: "Hoses, couplers, rams and leaks checked.",
  },
  {
    label: "Bearings",
    description: "Noise, heat, play and visible wear checked.",
  },
  {
    label: "Wear parts",
    description: "Blades, points, discs, tines or shoes checked.",
  },
  {
    label: "PTO / guards",
    description: "PTO shaft, covers and safety guards checked.",
  },
  {
    label: "Wheels / hubs",
    description: "Wheel nuts, hubs, bearings and tyres checked.",
  },
  {
    label: "Grease points",
    description: "Grease nipples and moving joints checked.",
  },
  {
    label: "Safety decals",
    description: "Warnings, reflectors and visible markings checked.",
  },
] as const;

const IMPLEMENT_SERVICED_OPTIONS: readonly ServiceOption[] = [
  {
    label: "Tightened bolts",
    description: "Loose fasteners tightened or replaced.",
  },
  {
    label: "Replaced pins / bushes",
    description: "Worn pins, bushes or clips replaced.",
  },
  {
    label: "Repaired frame / welds",
    description: "Cracks, bends or welds repaired.",
  },
  {
    label: "Replaced wear parts",
    description: "Blades, points, discs, tines or shoes replaced.",
  },
  {
    label: "Serviced hydraulics",
    description: "Hydraulic hoses, couplers or cylinders repaired.",
  },
  {
    label: "Replaced bearings",
    description: "Bearings, seals or hubs replaced.",
  },
  {
    label: "Greased implement",
    description: "Grease points and moving joints serviced.",
  },
  {
    label: "Serviced PTO / guards",
    description: "PTO shaft, covers or guards repaired.",
  },
  {
    label: "Adjusted setup",
    description: "Depth, angle, calibration or working setup adjusted.",
  },
  {
    label: "Wheel / hub service",
    description: "Wheel nuts, tyres, hubs or axles serviced.",
  },
  {
    label: "Cleaned implement",
    description: "Mud, crop material or residue removed.",
  },
] as const;

const IMPLEMENT_HINTS = [
  "implement",
  "implements",
  "tool",
  "tools",
  "attachment",
  "attachments",
  "trailer",
  "trailers",
  "header",
  "headers",
  "plough",
  "plow",
  "ripper",
  "cultivator",
  "harrow",
  "disc",
  "disk",
  "planter",
  "seeder",
  "seed drill",
  "fertilizer spreader",
  "spreader",
  "baler",
  "mower",
  "slasher",
  "mulcher",
  "roller",
  "auger",
  "fork",
  "blade",
] as const;

const PROPELLED_HINTS = [
  "vehicle",
  "bakkie",
  "truck",
  "tractor",
  "combine",
  "harvester",
  "self propelled",
  "self-propelled",
  "loader",
  "telehandler",
  "forklift",
  "excavator",
  "dozer",
  "bulldozer",
  "grader",
  "skid steer",
  "tlb",
] as const;

const initialDraft: DraftState = {
  hours: "",
  note: "",
  latitude: "",
  longitude: "",
  photoUrls: [],
  serviceMode: "",
  checkedItems: [],
  servicedItems: [],
  repairDetails: "",
  serviceCompany: "",
  mechanicName: "",
};

const initialPendingUpdate: PendingScanUpdate = {
  hours: "",
  notes: [],
  photoUrls: [],
  latitude: "",
  longitude: "",
  gpsAccuracyMeters: "",
  clientCapturedAt: "",
  clientEventId: "",
  hasUsage: false,
  hasService: false,
  hasPhotos: false,
  hasNotes: false,
};

const DEFAULT_LOCATION_REQUIRED_MESSAGE =
  "Location must be enabled before this asset QR can continue.";
const GPS_READY_SESSION_MESSAGE = "GPS ready for this QR scan session.";
const FIELD_MANAGER_RETURN_DELAY_MS = 1100;
const QR_SCAN_SESSION_STORAGE_PREFIX = "aim4price_qr_scan_session_v1:";

type QrScanSessionState = {
  publicAssetCode: string;
  assetId?: string;
  latitude?: string;
  longitude?: string;
  gpsAccuracyMeters?: string;
  locationMessage?: string;
  locationCapturedAtIso?: string;
  usageMode?: ScanAssetUsageMode;
  hours?: string;
  hasUsage?: boolean;
  updatedAtIso?: string;
};

function normalizePublicAssetCode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function normalizePinInput(value: string): string {
  return value.replace(/\D+/g, "").slice(0, 8);
}

function normalizeIntegerInput(value: string): string {
  return value.replace(/\D+/g, "");
}

function normalizePercentInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  const normalized =
    parts.length > 1
      ? `${parts[0]}.${parts.slice(1).join("").slice(0, 1)}`
      : parts[0];

  if (!normalized) return "";
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return "";
  if (parsed > 100) return "100";
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function qrScanSessionStorageKey(publicAssetCode: string): string {
  return `${QR_SCAN_SESSION_STORAGE_PREFIX}${normalizePublicAssetCode(publicAssetCode)}`;
}

function normalizeSessionString(value: unknown, maxLength = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeSessionUsageMode(
  value: unknown,
): ScanAssetUsageMode | undefined {
  if (
    value === "hours" ||
    value === "percent" ||
    value === "km" ||
    value === "none"
  )
    return value;
  return undefined;
}

function readQrScanSession(publicAssetCode: string): QrScanSessionState | null {
  if (typeof window === "undefined") return null;

  const normalizedCode = normalizePublicAssetCode(publicAssetCode);
  if (!normalizedCode) return null;

  try {
    const raw = window.sessionStorage.getItem(
      qrScanSessionStorageKey(normalizedCode),
    );
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const storedCode = normalizePublicAssetCode(
      normalizeSessionString(parsed.publicAssetCode),
    );
    if (storedCode !== normalizedCode) return null;

    const session: QrScanSessionState = {
      publicAssetCode: normalizedCode,
      assetId: normalizeSessionString(parsed.assetId, 80) || undefined,
      latitude: normalizeSessionString(parsed.latitude, 64) || undefined,
      longitude: normalizeSessionString(parsed.longitude, 64) || undefined,
      gpsAccuracyMeters:
        normalizeSessionString(parsed.gpsAccuracyMeters, 64) || undefined,
      locationMessage:
        normalizeSessionString(parsed.locationMessage, 240) || undefined,
      locationCapturedAtIso:
        normalizeSessionString(parsed.locationCapturedAtIso, 80) || undefined,
      usageMode: normalizeSessionUsageMode(parsed.usageMode),
      hours: normalizeSessionString(parsed.hours, 32) || undefined,
      hasUsage: parsed.hasUsage === true,
      updatedAtIso:
        normalizeSessionString(parsed.updatedAtIso, 80) || undefined,
    };

    return session;
  } catch {
    return null;
  }
}

function writeQrScanSession(
  publicAssetCode: string,
  session: QrScanSessionState,
): QrScanSessionState | null {
  if (typeof window === "undefined") return null;

  const normalizedCode = normalizePublicAssetCode(publicAssetCode);
  if (!normalizedCode) return null;

  const nextSession: QrScanSessionState = {
    ...session,
    publicAssetCode: normalizedCode,
    updatedAtIso: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(
      qrScanSessionStorageKey(normalizedCode),
      JSON.stringify(nextSession),
    );
    return nextSession;
  } catch {
    return nextSession;
  }
}

function updateQrScanSession(
  publicAssetCode: string,
  updater: (current: QrScanSessionState) => QrScanSessionState,
): QrScanSessionState | null {
  const normalizedCode = normalizePublicAssetCode(publicAssetCode);
  if (!normalizedCode) return null;

  const current = readQrScanSession(normalizedCode) ?? {
    publicAssetCode: normalizedCode,
  };
  return writeQrScanSession(normalizedCode, updater(current));
}

function clearQrScanSession(publicAssetCode: string): void {
  if (typeof window === "undefined") return;

  const normalizedCode = normalizePublicAssetCode(publicAssetCode);
  if (!normalizedCode) return;

  try {
    window.sessionStorage.removeItem(qrScanSessionStorageKey(normalizedCode));
  } catch {
    // Session storage is optional for this page.
  }
}

function sessionHasLocation(session: QrScanSessionState | null): boolean {
  return Boolean(session?.latitude?.trim() && session?.longitude?.trim());
}

function sessionLocationMessage(session: QrScanSessionState | null): string {
  return session?.locationMessage?.trim() || GPS_READY_SESSION_MESSAGE;
}

function applySessionLocationToDraft(
  draft: DraftState,
  session: QrScanSessionState | null,
): DraftState {
  if (!sessionHasLocation(session)) return draft;

  return {
    ...draft,
    latitude: draft.latitude || session?.latitude || "",
    longitude: draft.longitude || session?.longitude || "",
  };
}

function pendingLocationMetadata(
  session: QrScanSessionState | null,
): Pick<PendingScanUpdate, "gpsAccuracyMeters" | "clientCapturedAt"> {
  return {
    gpsAccuracyMeters: session?.gpsAccuracyMeters || "",
    clientCapturedAt: session?.locationCapturedAtIso || "",
  };
}

function scanLocationPayloadText(value: string | undefined): string {
  return String(value ?? "").trim();
}

function sessionUsageForAsset(
  asset: ScanSafeAsset,
  session: QrScanSessionState | null,
): { hasUsage: boolean; hours: string } {
  if (
    !session ||
    normalizePublicAssetCode(session.publicAssetCode) !==
      normalizePublicAssetCode(asset.publicAssetCode)
  ) {
    return { hasUsage: false, hours: "" };
  }

  if (session.assetId && session.assetId !== asset.id) {
    return { hasUsage: false, hours: "" };
  }

  if (session.usageMode && session.usageMode !== asset.usageMode) {
    return { hasUsage: false, hours: "" };
  }

  if (asset.usageMode === "hours" || asset.usageMode === "km") {
    const hours = normalizeIntegerInput(session.hours || "");
    return {
      hasUsage: session.hasUsage === true && hours !== "",
      hours,
    };
  }

  return { hasUsage: false, hours: "" };
}

function applySessionUsageToAsset(
  asset: ScanSafeAsset,
  session: QrScanSessionState | null,
): ScanSafeAsset {
  const usage = sessionUsageForAsset(asset, session);

  if (!usage.hasUsage) return asset;

  if (
    (asset.usageMode === "hours" || asset.usageMode === "km") &&
    usage.hours
  ) {
    const parsed = Number(usage.hours);
    return Number.isFinite(parsed) ? { ...asset, hours: parsed } : asset;
  }

  return asset;
}

function seedQrSessionFromAsset(
  publicAssetCode: string,
  asset: ScanSafeAsset,
): QrScanSessionState | null {
  return updateQrScanSession(publicAssetCode, (current) => ({
    ...current,
    publicAssetCode: normalizePublicAssetCode(asset.publicAssetCode),
    assetId: asset.id,
    usageMode: asset.usageMode,
    hours:
      current.hours ||
      (asset.usageMode === "hours" || asset.usageMode === "km"
        ? asset.hours !== null && Number.isFinite(asset.hours)
          ? String(Math.round(asset.hours))
          : undefined
        : undefined),
  }));
}

function normalizeOperatorName(value: string): string {
  return value.replace(/\s+/g, " ").slice(0, 80);
}

function imageFileNameAsJpeg(fileName: string): string {
  const cleanName = String(fileName || "qr-photo").trim() || "qr-photo";
  return cleanName.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = window.URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      window.URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      window.URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not prepare this photo."));
    };

    image.src = objectUrl;
  });
}

async function compressQrPhoto(file: File): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined")
    return file;
  if (!file.type.toLowerCase().startsWith("image/")) return file;
  if (
    file.size <= QR_PHOTO_SKIP_COMPRESSION_BYTES &&
    file.type.toLowerCase() === "image/jpeg"
  )
    return file;

  try {
    const image = await loadImageElement(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) return file;

    const scale = Math.min(
      1,
      QR_PHOTO_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight),
    );
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return file;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", QR_PHOTO_JPEG_QUALITY);
    });

    if (!blob || !blob.size) return file;
    if (blob.size >= file.size) return file;

    return new File([blob], imageFileNameAsJpeg(file.name), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

function hasLocationCaptured(draft: DraftState): boolean {
  return Boolean(draft.latitude.trim() && draft.longitude.trim());
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-ZA").format(Math.round(value));
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}%`;
}

function formatAssetStatusChoice(value?: ScanAssetStatusChoice | null): string {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  if (value === "not_applicable") return "Not applicable";
  return "Not sure";
}

function formatUsage(asset: ScanSafeAsset | null): string {
  if (!asset) return "—";

  if (asset.usageMode === "percent") {
    return asset.lifeWorkedPercent === null
      ? "—"
      : `${formatPercent(asset.lifeWorkedPercent)} worked`;
  }

  if (asset.usageMode === "km") {
    return asset.hours === null ? "—" : `${formatNumber(asset.hours)} km`;
  }

  if (asset.usageMode === "hours") {
    return asset.hours === null ? "—" : `${formatNumber(asset.hours)} hours`;
  }

  return "Not tracked";
}

function usageTitle(asset: ScanSafeAsset | null): string {
  if (!asset) return "Usage";
  if (asset.usageMode === "percent") return "Lifetime worked";
  if (asset.usageMode === "km") return "Odometer";
  if (asset.usageMode === "hours") return "Hour meter";
  return "Usage";
}

function usageModalLabel(asset: ScanSafeAsset): string {
  if (asset.usageMode === "km") return "Current kilometre reading";
  return "Current hour-meter reading";
}

function usagePlaceholder(asset: ScanSafeAsset): string {
  if (asset.usageMode === "km") {
    return asset.hours !== null
      ? String(Math.round(asset.hours))
      : "Enter current kilometres";
  }

  return asset.hours !== null
    ? String(Math.round(asset.hours))
    : "Enter current hours";
}

function assetScanMeta(asset: ScanSafeAsset | null): string {
  if (!asset) return "Enter the farm PIN to open this asset.";

  const serialText = asset.serialNumber
    ? `Serial ${asset.serialNumber}`
    : "Serial not captured";
  const usageText = formatUsage(asset);

  if (!usageText || usageText === "—" || usageText === "Not tracked") {
    return serialText;
  }

  return `${serialText} · ${usageText}`;
}

function assetPlaceholderLabel(asset: ScanSafeAsset): string {
  const label = asset.equipmentFamilyLabel || asset.kind || "Asset";
  return label.replace(/[_-]+/g, " ").trim() || "Asset";
}

function normalizeClassifierText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function assetClassifierText(asset: ScanSafeAsset): string {
  return normalizeClassifierText(
    [
      asset.kind,
      asset.equipmentFamilyKey,
      asset.equipmentFamilyLabel,
      asset.title,
    ].join(" "),
  );
}

function containsAnyHint(text: string, hints: readonly string[]): boolean {
  return hints.some((hint) => text.includes(hint));
}

function resolveAssetServiceProfile(
  asset: ScanSafeAsset | null,
): AssetServiceProfile {
  if (!asset) return "propelled";

  if (
    asset.isPropelled ||
    asset.canUpdateFuel ||
    asset.kind === "vehicle" ||
    asset.kind === "tractor"
  ) {
    return "propelled";
  }

  const classifierText = assetClassifierText(asset);

  if (containsAnyHint(classifierText, IMPLEMENT_HINTS)) {
    return "implement";
  }

  if (asset.usageMode === "percent") {
    return "implement";
  }

  if (
    containsAnyHint(classifierText, PROPELLED_HINTS) ||
    asset.usageMode === "km" ||
    asset.usageMode === "hours"
  ) {
    return "propelled";
  }

  return "implement";
}

function checkedOptionsForProfile(
  profile: AssetServiceProfile,
): readonly ServiceOption[] {
  return profile === "implement"
    ? IMPLEMENT_CHECKED_OPTIONS
    : PROPELLED_CHECKED_OPTIONS;
}

function servicedOptionsForProfile(
  profile: AssetServiceProfile,
): readonly ServiceOption[] {
  return profile === "implement"
    ? IMPLEMENT_SERVICED_OPTIONS
    : PROPELLED_SERVICED_OPTIONS;
}

function serviceCopyForProfile(profile: AssetServiceProfile) {
  if (profile === "implement") {
    return {
      checkedDescription: "Inspection.",
      servicedDescription: "Service job.",
      repairedDescription: "Repair job.",
      checkedTitle: "Check",
      servicedTitle: "Service",
      repairedTitle: "Repair",
      checkedPrompt: "Select inspected items.",
      servicedPrompt: "Select work done.",
      repairedPrompt: "Fault · fix · parts.",
      checkedHeader: "Checked items",
      checkedSubheader: "Select every item inspected.",
      servicedHeader: "Service work",
      servicedSubheader: "Select work completed.",
      repairedHeader: "Repair note",
      repairedSubheader: "Capture the fault, fix and parts replaced.",
      detailsHeader: "Who did the work?",
      detailsSubheader: "Company and technician.",
      companyLabel: "Company / Workshop",
      companyPlaceholder: "Company or workshop name",
      mechanicLabel: "Technician name",
      mechanicPlaceholder: "Technician name",
      checkedNotePlaceholder:
        "Example: bolts checked, pins checked, no visible cracks.",
      servicedNotePlaceholder:
        "Example: replaced points, tightened bolts and greased pins.",
      repairedNotePlaceholder:
        "Example: cracked bracket repaired; two bushes replaced; welds checked.",
      repairedExtraNotePlaceholder: "Optional: parts used or follow-up needed.",
    };
  }

  return {
    checkedDescription: "Inspection.",
    servicedDescription: "Service job.",
    repairedDescription: "Repair job.",
    checkedTitle: "Check",
    servicedTitle: "Service",
    repairedTitle: "Repair",
    checkedPrompt: "Select inspected items.",
    servicedPrompt: "Select work done.",
    repairedPrompt: "Fault · fix · parts.",
    checkedHeader: "Checked items",
    checkedSubheader: "Select every item inspected.",
    servicedHeader: "Service work",
    servicedSubheader: "Select work completed.",
    repairedHeader: "Repair note",
    repairedSubheader: "Capture the fault, fix and parts replaced.",
    detailsHeader: "Who did the work?",
    detailsSubheader: "Company and mechanic.",
    companyLabel: "Company / Dealer",
    companyPlaceholder: "Company or dealer name",
    mechanicLabel: "Mechanic name",
    mechanicPlaceholder: "Mechanic name",
    checkedNotePlaceholder:
      "Example: oil checked, tyres checked, no visible leaks.",
    servicedNotePlaceholder:
      "Example: full service completed; oil and filters replaced.",
    repairedNotePlaceholder:
      "Example: hydraulic leak repaired; hose replaced; pressure tested.",
    repairedExtraNotePlaceholder: "Optional: parts used or follow-up needed.",
  };
}

function buildEditorSummary(
  editor: EditorKey,
  asset: ScanSafeAsset | null,
): string {
  if (editor === "usage") return formatUsage(asset);

  if (editor === "service") return "Check Service Repair";

  if (editor === "notes") return "Issues & Problems";

  if (asset?.photos.length) {
    return `${asset.photos.length} photo${asset.photos.length === 1 ? "" : "s"} stored`;
  }

  return "Upload or take photos";
}

function isMeterUsageMode(asset: ScanSafeAsset | null): boolean {
  return asset?.usageMode === "hours" || asset?.usageMode === "km";
}

function needsUsageUpdateBeforeActions(
  asset: ScanSafeAsset | null,
  update: PendingScanUpdate,
  hasCompletedRequiredUsageUpdate: boolean,
): boolean {
  return Boolean(
    isMeterUsageMode(asset) &&
    !update.hasUsage &&
    !hasCompletedRequiredUsageUpdate,
  );
}

function requiredUsageTitle(asset: ScanSafeAsset): string {
  if (asset.usageMode === "km") return "Update kilometres first";
  return "Update hours first";
}

function requiredUsageCopy(asset: ScanSafeAsset): string {
  if (asset.usageMode === "km") {
    return "Enter the latest kilometre reading before maintenance or photos can be added.";
  }

  return "Enter the latest hour-meter reading before maintenance or photos can be added.";
}

function requiredUsageButtonLabel(asset: ScanSafeAsset): string {
  if (asset.usageMode === "km") return "Update kilometres";
  return "Update hours";
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function mergeUniqueStrings(values: string[], limit?: number): string[] {
  const seen = new Set<string>();
  const merged = values
    .map((entry) => String(entry ?? "").trim())
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });

  return typeof limit === "number" ? merged.slice(0, limit) : merged;
}

function hasPendingScanUpdate(update: PendingScanUpdate): boolean {
  return (
    update.hasUsage || update.hasService || update.hasPhotos || update.hasNotes
  );
}

function keepCurrentLocation(
  current: DraftState,
  session: QrScanSessionState | null = null,
): DraftState {
  return {
    ...initialDraft,
    latitude: current.latitude || session?.latitude || "",
    longitude: current.longitude || session?.longitude || "",
  };
}

function buildServiceNote(draft: DraftState): string {
  const note = draft.note.trim();

  if (draft.serviceMode === "checked") {
    return [
      "Checked",
      draft.checkedItems.length
        ? `Checked items: ${draft.checkedItems.join(", ")}`
        : "",
      note ? `Notes/Problems: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (draft.serviceMode === "serviced") {
    return [
      "Serviced",
      draft.servicedItems.length
        ? `Work done: ${draft.servicedItems.join(", ")}`
        : "",
      draft.serviceCompany.trim()
        ? `Company: ${draft.serviceCompany.trim()}`
        : "",
      draft.mechanicName.trim() ? `Mechanic: ${draft.mechanicName.trim()}` : "",
      note ? `Notes/Problems: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (draft.serviceMode === "repaired") {
    return [
      "Repaired",
      draft.repairDetails.trim()
        ? `Repair details: ${draft.repairDetails.trim()}`
        : "",
      draft.serviceCompany.trim()
        ? `Company: ${draft.serviceCompany.trim()}`
        : "",
      draft.mechanicName.trim() ? `Mechanic: ${draft.mechanicName.trim()}` : "",
      note ? `Notes/Problems: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return note;
}

declare global {
  interface Window {
    L?: any;
  }
}

function loadScanLeaflet(): Promise<any> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Map is only available in the browser."));
  }

  if (window.L) {
    return Promise.resolve(window.L);
  }

  if (scanLeafletLoaderPromise) {
    return scanLeafletLoaderPromise;
  }

  scanLeafletLoaderPromise = new Promise((resolve, reject) => {
    if (!document.getElementById(SCAN_LEAFLET_CSS_ID)) {
      const link = document.createElement("link");
      link.id = SCAN_LEAFLET_CSS_ID;
      link.rel = "stylesheet";
      link.href = SCAN_LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(
      SCAN_LEAFLET_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    const resolveWhenReady = () => {
      if (window.L) {
        resolve(window.L);
      } else {
        reject(new Error("Map could not be loaded."));
      }
    };

    if (existingScript) {
      existingScript.addEventListener("load", resolveWhenReady, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Map could not be loaded.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCAN_LEAFLET_SCRIPT_ID;
    script.src = SCAN_LEAFLET_JS_URL;
    script.async = true;
    script.addEventListener("load", resolveWhenReady, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Map could not be loaded.")),
      { once: true },
    );
    document.body.appendChild(script);
  });

  return scanLeafletLoaderPromise;
}

function dealerPartnerName(partner: PartnerDirectoryEntry): string {
  return partner.businessName || partner.displayName || "Aim4price dealer";
}

function dealerPartnerLocation(partner: PartnerDirectoryEntry): string {
  return (
    [partner.townCity, partner.province].filter(Boolean).join(", ") ||
    "Location not saved"
  );
}

function dealerPartnerInitial(partner: PartnerDirectoryEntry): string {
  const name = dealerPartnerName(partner);
  return name.trim().charAt(0).toUpperCase() || "D";
}

function dealerPartnerAddress(partner: PartnerDirectoryEntry): string {
  return [partner.addressLine1, partner.townCity, partner.province]
    .filter(Boolean)
    .join(", ");
}

function dealerPartnerServicesDisplay(partner: PartnerDirectoryEntry): string {
  return partner.services || partner.brandFocus || "Dealer services";
}

function hasDealerPartnerCoordinates(partner: PartnerDirectoryEntry): boolean {
  return (
    typeof partner.latitude === "number" &&
    Number.isFinite(partner.latitude) &&
    typeof partner.longitude === "number" &&
    Number.isFinite(partner.longitude)
  );
}

function normalizeWebsiteHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function formatWebsiteDisplay(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function normalizePhoneHref(value: string): string {
  const cleaned = value.replace(/[^+0-9]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

function normalizeEmailHref(value: string): string {
  const email = value.trim();
  return email ? `mailto:${email}` : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildDealerPartnerPopupHtml(partner: PartnerDirectoryEntry): string {
  const name = escapeHtml(dealerPartnerName(partner));
  const location = escapeHtml(dealerPartnerLocation(partner));
  const services = escapeHtml(dealerPartnerServicesDisplay(partner));
  const userId = escapeHtml(partner.userId);

  return `
    <div class="scanSharePopup">
      <strong>${name}</strong>
      <span>${location}</span>
      <small>${services}</small>
      <button type="button" class="scanSharePopupChooseButton" data-scan-share-partner-id="${userId}">Get assistance</button>
    </div>
  `;
}

function apiErrorMessage(
  payload: { error?: string } | null | undefined,
  fallback: string,
): string {
  return payload?.error || fallback;
}

type IconProps = { className?: string };

function MeterIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M7 17h10" />
      <path d="M12 17l4.2-5.2" />
      <path d="M7.7 10.4l.8.8" />
      <path d="M16.3 10.4l-.8.8" />
      <path d="M12 8.2v1.2" />
    </svg>
  );
}

function ServiceIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.1" />
      <path d="M12 19.1v2.1" />
      <path d="M4.9 4.9 6.4 6.4" />
      <path d="m17.6 17.6 1.5 1.5" />
      <path d="M2.8 12h2.1" />
      <path d="M19.1 12h2.1" />
      <path d="m4.9 19.1 1.5-1.5" />
      <path d="m17.6 6.4 1.5-1.5" />
    </svg>
  );
}

function CheckCircleIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.4 12.3 2.3 2.3 5-5.2" />
    </svg>
  );
}

function WrenchIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14.7 6.2a4.5 4.5 0 0 0-5.4 5.6L4.4 16.7a1.6 1.6 0 0 0 0 2.2l.7.7a1.6 1.6 0 0 0 2.2 0l4.9-4.9a4.5 4.5 0 0 0 5.6-5.4l-3 3-3.1-3.1z" />
      <path d="M5.8 18.2h.01" />
    </svg>
  );
}

function RepairIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M13.4 2.8 4.8 13.3c-.5.6-.1 1.5.7 1.5h5.1l-1.2 6.1c-.2 1 .9 1.6 1.6.8l8.6-10.8c.5-.6 0-1.5-.7-1.5h-5.1l1.2-5.8c.2-1-.9-1.6-1.6-.8z" />
    </svg>
  );
}

function NoteIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3.8h9.2L19 7.6v12.6H6z" />
      <path d="M15 3.8v4h4" />
      <path d="M9 12h6" />
      <path d="M9 15.5h5" />
    </svg>
  );
}

function UploadIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 15.5V4.5" />
      <path d="m7.2 9.2 4.8-4.8 4.8 4.8" />
      <path d="M5 19.5h14" />
      <path d="M7 16.5h10" />
    </svg>
  );
}

function CameraIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 8a2 2 0 0 1 2-2h2.6l1.4-2h4l1.4 2H18a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="4" />
      <path d="M17 9h.01" />
    </svg>
  );
}

function ShareIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.6 6.6-4.2" />
      <path d="m8.7 13.4 6.6 4.2" />
    </svg>
  );
}

function LocationIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 21s-6.5-4.4-6.5-10.2a6.5 6.5 0 1 1 13 0C18.5 16.6 12 21 12 21z" />
      <circle cx="12" cy="10.8" r="2.4" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export default function ScanClient({
  publicAssetCode,
  fieldManagerMode = false,
  fieldManagerAssetId = null,
}: {
  publicAssetCode: string;
  fieldManagerMode?: boolean;
  fieldManagerAssetId?: string | null;
}) {
  const normalizedCode = useMemo(
    () => normalizePublicAssetCode(publicAssetCode),
    [publicAssetCode],
  );
  const normalizedFieldManagerAssetId = useMemo(
    () => String(fieldManagerAssetId ?? "").trim(),
    [fieldManagerAssetId],
  );

  const [asset, setAsset] = useState<ScanSafeAsset | null>(null);
  const [savedAsset, setSavedAsset] = useState<ScanSafeAsset | null>(null);
  const [assetPreview, setAssetPreview] = useState<ScanSafeAsset | null>(null);
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [pendingUpdate, setPendingUpdate] =
    useState<PendingScanUpdate>(initialPendingUpdate);
  const [pin, setPin] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [scanAccessMode, setScanAccessMode] =
    useState<ScanAccessResponseMode | null>(null);
  const [notice, setNotice] = useState<{
    tone: NoticeTone;
    message: string;
  } | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [doneMessage, setDoneMessage] = useState(
    "The QR update session is closed.",
  );
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [isLoadingAsset, setIsLoadingAsset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [locationMessage, setLocationMessage] = useState(
    DEFAULT_LOCATION_REQUIRED_MESSAGE,
  );
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [assetOpenError, setAssetOpenError] = useState<string | null>(null);
  const [activeEditor, setActiveEditor] = useState<EditorKey | null>(null);
  const [showLocationReminder, setShowLocationReminder] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [hasCompletedRequiredUsageUpdate, setHasCompletedRequiredUsageUpdate] =
    useState(false);
  const [showServiceDetailsStep, setShowServiceDetailsStep] = useState(false);
  const [showServicePhotoStep, setShowServicePhotoStep] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharePartners, setSharePartners] = useState<PartnerDirectoryEntry[]>(
    [],
  );
  const [sharePartnerSearch, setSharePartnerSearch] = useState("");
  const [selectedSharePartnerId, setSelectedSharePartnerId] = useState("");
  const [shareOwnerMessage, setShareOwnerMessage] = useState("");
  const [sharePhotoUrls, setSharePhotoUrls] = useState<string[]>([]);
  const [shareLeadStep, setShareLeadStep] = useState<ShareLeadStep>(null);
  const [shareConsentAccepted, setShareConsentAccepted] = useState(false);
  const [isLoadingSharePartners, setIsLoadingSharePartners] = useState(false);
  const [isSendingShareLead, setIsSendingShareLead] = useState(false);
  const [isUploadingSharePhoto, setIsUploadingSharePhoto] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const sharePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const autoLocationKeyRef = useRef<string>("");
  const shareMapElementRef = useRef<HTMLDivElement | null>(null);
  const shareLeafletMapRef = useRef<any>(null);
  const shareMarkerLayerRef = useRef<any>(null);
  const shareMarkersByPartnerRef = useRef<Map<string, any>>(new Map());
  const autoFieldManagerOpenKeyRef = useRef<string>("");

  useEffect(() => {
    const previousBodyBackground = document.body.style.background;
    const footerElements = Array.from(
      document.querySelectorAll<HTMLElement>("footer"),
    );
    const previousFooterDisplays = footerElements.map((element) => ({
      element,
      display: element.style.display,
    }));

    document.body.style.background = "#f3f7f8";
    footerElements.forEach((element) => {
      element.style.display = "none";
    });

    if (!fieldManagerMode) {
      try {
        const savedName = window.localStorage.getItem(
          "aim4price_scan_operator_name",
        );
        if (savedName) setOperatorName(savedName);
      } catch {
        // Local storage is optional for this screen.
      }
    }

    return () => {
      document.body.style.background = previousBodyBackground;
      previousFooterDisplays.forEach(({ element, display }) => {
        element.style.display = display;
      });
    };
  }, [fieldManagerMode]);

  useEffect(() => {
    setAsset(null);
    setSavedAsset(null);
    setAssetPreview(null);
    setScanAccessMode(null);
    const restoredSession = readQrScanSession(normalizedCode);
    const restoredDraft = applySessionLocationToDraft(
      initialDraft,
      restoredSession,
    );
    setDraft(restoredDraft);
    setPendingUpdate({
      ...initialPendingUpdate,
      latitude: restoredDraft.latitude,
      longitude: restoredDraft.longitude,
      ...pendingLocationMetadata(restoredSession),
    });
    setPin("");
    setIsUnavailable(false);
    setAssetOpenError(null);
    setIsSubmittingPin(false);
    setIsLoadingAsset(false);
    setIsSaving(false);
    setIsUploading(false);
    setActiveEditor(null);
    setShowLocationReminder(false);
    setIsDone(false);
    setDoneMessage("The QR update session is closed.");
    setHasCompletedRequiredUsageUpdate(false);
    setShowServiceDetailsStep(false);
    setShowServicePhotoStep(false);
    setIsShareModalOpen(false);
    setSharePartners([]);
    setSharePartnerSearch("");
    setSelectedSharePartnerId("");
    setShareOwnerMessage("");
    setSharePhotoUrls([]);
    setShareLeadStep(null);
    setShareConsentAccepted(false);
    setIsLoadingSharePartners(false);
    setIsSendingShareLead(false);
    setIsUploadingSharePhoto(false);
    if (sessionHasLocation(restoredSession)) {
      setLocationState("ready");
      setLocationMessage(sessionLocationMessage(restoredSession));
    } else {
      setLocationState("idle");
      setLocationMessage(DEFAULT_LOCATION_REQUIRED_MESSAGE);
    }
    if (shareLeafletMapRef.current) {
      shareLeafletMapRef.current.remove();
      shareLeafletMapRef.current = null;
      shareMarkerLayerRef.current = null;
      shareMarkersByPartnerRef.current.clear();
    }
    autoLocationKeyRef.current = "";
    autoFieldManagerOpenKeyRef.current = "";
  }, [fieldManagerMode, normalizedCode, normalizedFieldManagerAssetId]);

  useEffect(() => {
    let isMounted = true;

    async function loadAssetPreview() {
      if (!normalizedCode) return;

      try {
        const response = await fetch(
          `/api/scan/assets/${encodeURIComponent(normalizedCode)}?preview=1`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        const data = (await response
          .json()
          .catch(() => null)) as ScanAssetResponse | null;

        if (!isMounted) return;

        if (response.ok && data?.ok && data.asset) {
          setAssetPreview(data.asset);
          return;
        }

        // Preview is only a convenience for showing the asset title before unlock.
        // It must never block the public QR PIN/name form or Field Manager auto-open flow.
      } catch {
        // Keep the PIN page usable even if preview data cannot be loaded.
      }
    }

    void loadAssetPreview();

    return () => {
      isMounted = false;
    };
  }, [normalizedCode]);

  useEffect(() => {
    if (
      !fieldManagerMode ||
      !normalizedCode ||
      autoFieldManagerOpenKeyRef.current === `${normalizedCode}:${normalizedFieldManagerAssetId}`
    )
      return;

    autoFieldManagerOpenKeyRef.current = `${normalizedCode}:${normalizedFieldManagerAssetId}`;
    void loadUnlockedAsset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldManagerMode, normalizedCode, normalizedFieldManagerAssetId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    let isMounted = true;
    const kinds: PendingSyncKind[] = ["asset-scan-update"];

    async function refreshPendingCount() {
      const count = await getOfflineMutationCount(kinds);
      if (isMounted) setPendingSyncCount(count);
    }

    async function syncQueuedUpdates() {
      const result = await syncOfflineMutations({ kinds });
      if (!isMounted) return;
      setPendingSyncCount(result.pendingCount);
      if (result.syncedCount > 0) {
        setNotice({
          tone: "success",
          message:
            result.syncedCount === 1
              ? "Saved phone update synced."
              : `${result.syncedCount} saved phone updates synced.`,
        });
      }
    }

    void refreshPendingCount();
    void syncQueuedUpdates();

    const handleOnline = () => void syncQueuedUpdates();
    const handleFocus = () => void syncQueuedUpdates();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void syncQueuedUpdates();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!activeEditor && !isShareModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeEditor, isShareModalOpen]);

  useEffect(() => {
    if (!isShareModalOpen || !asset) return;
    void loadSharePartners(sharePartnerSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShareModalOpen, asset?.id]);

  useEffect(() => {
    if (!isShareModalOpen || shareLeadStep || !shareMapElementRef.current)
      return undefined;

    const partnersWithCoordinates = sharePartners.filter(
      hasDealerPartnerCoordinates,
    );
    let isCancelled = false;

    if (!partnersWithCoordinates.length) {
      if (shareMarkerLayerRef.current) {
        shareMarkerLayerRef.current.clearLayers();
        shareMarkersByPartnerRef.current.clear();
      }
      return undefined;
    }

    async function renderShareMap() {
      try {
        const leaflet = await loadScanLeaflet();
        if (isCancelled || !shareMapElementRef.current) return;

        if (!shareLeafletMapRef.current) {
          shareLeafletMapRef.current = leaflet
            .map(shareMapElementRef.current, { scrollWheelZoom: false })
            .setView(DEFAULT_DEALER_MAP_CENTER, DEFAULT_DEALER_MAP_ZOOM);

          leaflet
            .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
              attribution: "&copy; OpenStreetMap contributors",
              maxZoom: 19,
            })
            .addTo(shareLeafletMapRef.current);

          shareMarkerLayerRef.current = leaflet
            .layerGroup()
            .addTo(shareLeafletMapRef.current);
        }

        const map = shareLeafletMapRef.current;
        const markerLayer = shareMarkerLayerRef.current;
        markerLayer.clearLayers();
        shareMarkersByPartnerRef.current.clear();

        const bounds = leaflet.latLngBounds([]);

        partnersWithCoordinates.forEach((partner) => {
          const marker = leaflet.marker([partner.latitude, partner.longitude], {
            icon: leaflet.divIcon({
              className: "scanShareMapMarker",
              html: `<span>${escapeHtml(dealerPartnerInitial(partner))}</span>`,
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            }),
          });

          marker.bindPopup(buildDealerPartnerPopupHtml(partner), {
            closeButton: false,
            maxWidth: 320,
          });

          marker.on("popupopen", () => {
            window.setTimeout(() => {
              const popupElement = marker.getPopup?.()?.getElement?.();
              const button = popupElement?.querySelector?.(
                "button[data-scan-share-partner-id]",
              ) as HTMLButtonElement | null;
              button?.addEventListener(
                "click",
                () => openShareLeadMessage(partner),
                { once: true },
              );
            }, 0);
          });

          marker.addTo(markerLayer);
          shareMarkersByPartnerRef.current.set(partner.userId, marker);
          bounds.extend([partner.latitude, partner.longitude]);
        });

        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.22), { maxZoom: 9 });
        }

        window.setTimeout(() => map.invalidateSize(), 120);
      } catch {
        // The dealer list remains usable if the map script cannot be loaded.
      }
    }

    void renderShareMap();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShareModalOpen, shareLeadStep, sharePartners]);

  useEffect(() => {
    if (!isShareModalOpen || shareLeadStep || !selectedSharePartnerId) return;
    const selectedPartner = sharePartners.find(
      (partner) => partner.userId === selectedSharePartnerId,
    );
    if (!selectedPartner || !hasDealerPartnerCoordinates(selectedPartner))
      return;

    const map = shareLeafletMapRef.current;
    const marker = shareMarkersByPartnerRef.current.get(selectedPartner.userId);

    if (!map || !marker) return;

    map.setView(
      [selectedPartner.latitude, selectedPartner.longitude],
      Math.max(map.getZoom?.() ?? DEFAULT_DEALER_MAP_ZOOM, 8),
      { animate: true },
    );
    marker.openPopup();
  }, [isShareModalOpen, shareLeadStep, selectedSharePartnerId, sharePartners]);

  useEffect(() => {
    if (!asset?.id) return;
    if (autoLocationKeyRef.current === asset.id) return;
    autoLocationKeyRef.current = asset.id;

    const storedSession = readQrScanSession(normalizedCode);
    if (hasLocationCaptured(draft) || sessionHasLocation(storedSession)) {
      if (!hasLocationCaptured(draft) && sessionHasLocation(storedSession)) {
        setDraft((current) =>
          applySessionLocationToDraft(current, storedSession),
        );
      }
      setLocationState("ready");
      setLocationMessage(sessionLocationMessage(storedSession));
      return;
    }

    void captureLocation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id]);

  function fieldManagerQueryString(): string {
    if (!fieldManagerMode) return "";

    const params = new URLSearchParams({ fieldManager: "1" });
    if (normalizedFieldManagerAssetId) {
      params.set("assetId", normalizedFieldManagerAssetId);
    }

    return `?${params.toString()}`;
  }

  async function redirectAfterFieldManagerServerSave() {
    clearQrScanSession(normalizedCode);
    setActiveEditor(null);
    setShowLocationReminder(false);
    setNotice(null);
    setDoneMessage("");
    setIsDone(true);

    try {
      window.history.replaceState(
        { aim4priceQrDone: true },
        "",
        window.location.href,
      );
    } catch {
      // Ignore history replacement errors.
    }

    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);

    window.setTimeout(() => {
      window.location.replace("/field-manager");
    }, FIELD_MANAGER_RETURN_DELAY_MS);
  }

  async function loadUnlockedAsset(): Promise<boolean> {
    setIsLoadingAsset(true);
    setIsUnavailable(false);
    setAssetOpenError(null);

    try {
      const query = fieldManagerQueryString();
      const response = await fetch(
        `/api/scan/assets/${encodeURIComponent(normalizedCode)}${query}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const data = (await response
        .json()
        .catch(() => null)) as ScanAssetResponse | null;

      if (response.status === 401 && fieldManagerMode) {
        setAsset(null);
        setIsUnavailable(true);
        setAssetOpenError(
          data?.error ??
            "Could not open this asset. Your Field Manager session may not have access to this asset. Please go back and try again.",
        );
        return false;
      }

      if (response.status === 401) {
        const message = data?.error ?? "Enter the farm scan PIN again.";
        setAsset(null);
        setIsUnavailable(false);
        setAssetOpenError(null);
        setNotice({ tone: "error", message });
        return false;
      }

      if (
        response.status === 403 ||
        response.status === 404 ||
        response.status === 409
      ) {
        const message =
          data?.error ??
          (response.status === 404
            ? "Asset not found."
            : fieldManagerMode
              ? "Could not open this asset. Your Field Manager session may not have access to this asset. Please go back and try again."
              : "Scan access is not enabled yet.");
        setAsset(null);
        setIsUnavailable(true);
        setAssetOpenError(message);
        return false;
      }

      if (!response.ok || !data?.ok || !data.asset) {
        const message = data?.error ?? "Failed to open this asset.";
        setAsset(null);
        setIsUnavailable(true);
        setAssetOpenError(message);
        return false;
      }

      setScanAccessMode(data.accessMode ?? null);

      if (
        data.accessMode === "field_manager" &&
        data.fieldManagerDisplayName?.trim()
      ) {
        const managerOperatorName = normalizeOperatorName(
          data.fieldManagerDisplayName,
        );
        if (managerOperatorName) setOperatorName(managerOperatorName);
      }

      const openedAsset = data.asset;
      const isFieldManagerAccess =
        fieldManagerMode || data.accessMode === "field_manager";
      const seededSession =
        seedQrSessionFromAsset(normalizedCode, openedAsset) ??
        readQrScanSession(normalizedCode);
      const sessionUsage = sessionUsageForAsset(openedAsset, seededSession);
      const openedAssetWithSessionUsage = applySessionUsageToAsset(
        openedAsset,
        seededSession,
      );
      const requiresInitialUsageUpdate =
        !isFieldManagerAccess &&
        isMeterUsageMode(openedAsset) &&
        !sessionUsage.hasUsage;
      const restoredLatitude = seededSession?.latitude || draft.latitude;
      const restoredLongitude = seededSession?.longitude || draft.longitude;
      const nextDraftBase = {
        ...initialDraft,
        latitude: restoredLatitude,
        longitude: restoredLongitude,
      };
      const nextDraft =
        openedAsset.usageMode === "hours" || openedAsset.usageMode === "km"
          ? {
              ...nextDraftBase,
              hours:
                sessionUsage.hours ||
                (openedAsset.hours !== null
                  ? String(Math.round(openedAsset.hours))
                  : ""),
            }
          : nextDraftBase;

      setAsset(openedAssetWithSessionUsage);
      setSavedAsset(openedAsset);
      setAssetPreview(openedAssetWithSessionUsage);
      setDraft(nextDraft);
      setPendingUpdate({
        ...initialPendingUpdate,
        latitude: restoredLatitude,
        longitude: restoredLongitude,
        hours: sessionUsage.hours,
        hasUsage: sessionUsage.hasUsage,
      });
      setIsDone(false);
      setHasCompletedRequiredUsageUpdate(!requiresInitialUsageUpdate);
      setShowLocationReminder(false);
      setActiveEditor(requiresInitialUsageUpdate ? "usage" : null);
      setAssetOpenError(null);
      setIsUnavailable(false);
      if (restoredLatitude && restoredLongitude) {
        setLocationState("ready");
        setLocationMessage(sessionLocationMessage(seededSession));
      }
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Failed to open this asset.";
      setAsset(null);
      setIsUnavailable(true);
      setAssetOpenError(message);
      return false;
    } finally {
      setIsLoadingAsset(false);
    }
  }

  function goBackFromAssetError() {
    if (fieldManagerMode) {
      window.location.assign("/field-manager/assets");
      return;
    }

    window.history.back();
  }

  async function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanOperatorName = operatorName.trim();

    if (pin.length < 4) {
      setNotice({ tone: "error", message: "Enter the farm scan PIN." });
      return;
    }

    if (cleanOperatorName.length < 2) {
      setNotice({
        tone: "error",
        message: "Enter your name before opening the asset.",
      });
      return;
    }

    const storedSession = readQrScanSession(normalizedCode);
    const hasSessionLocation =
      hasLocationCaptured(draft) || sessionHasLocation(storedSession);

    if (!hasSessionLocation) {
      setNotice({
        tone: "error",
        message:
          "Capture GPS first. Location must be enabled before this asset QR can continue.",
      });
      void captureLocation(false);
      return;
    }

    if (!hasLocationCaptured(draft) && sessionHasLocation(storedSession)) {
      setDraft((current) =>
        applySessionLocationToDraft(current, storedSession),
      );
      setLocationState("ready");
      setLocationMessage(sessionLocationMessage(storedSession));
    }

    setIsSubmittingPin(true);
    setIsUnavailable(false);
    setAssetOpenError(null);

    try {
      const response = await fetch("/api/scan/auth", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicAssetCode: normalizedCode, pin }),
      });
      const data = (await response
        .json()
        .catch(() => null)) as ScanAuthResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Incorrect scan PIN.");
      }

      try {
        window.localStorage.setItem(
          "aim4price_scan_operator_name",
          cleanOperatorName,
        );
      } catch {
        // Ignore local storage errors.
      }

      setPin("");
      await loadUnlockedAsset();
    } catch (error) {
      setAsset(null);
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Incorrect scan PIN.",
      });
    } finally {
      setIsSubmittingPin(false);
    }
  }

  async function uploadScanPhotoFiles(
    files: File[],
  ): Promise<ScanUploadedPhoto[]> {
    const compressedFiles = await Promise.all(
      files.map((file) => compressQrPhoto(file)),
    );
    const formData = new FormData();
    formData.set("publicAssetCode", normalizedCode);
    compressedFiles.forEach((file) => formData.append("files", file));

    const uploadEndpoint = `/api/scan/uploads${fieldManagerQueryString()}`;
    const response = await fetch(uploadEndpoint, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const data = (await response
      .json()
      .catch(() => null)) as ScanUploadResponse | null;

    if (!response.ok || !data?.ok || !data.uploads?.length) {
      throw new Error(data?.error ?? "Failed to upload photos.");
    }

    return data.uploads;
  }

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []) as File[];
    if (!selectedFiles.length) return;

    const remainingSlots = MAX_QR_PHOTOS - draft.photoUrls.length;
    if (remainingSlots <= 0) {
      setNotice({
        tone: "error",
        message: `You can add up to ${MAX_QR_PHOTOS} photos per update.`,
      });
      event.target.value = "";
      return;
    }

    const files = selectedFiles.slice(0, remainingSlots);
    setIsUploading(true);

    try {
      const uploads = await uploadScanPhotoFiles(files);
      const uploadedUrls = uploads.map((entry) => entry.url);

      setDraft((current) => ({
        ...current,
        photoUrls: Array.from(
          new Set([...current.photoUrls, ...uploadedUrls]),
        ).slice(0, MAX_QR_PHOTOS),
      }));

      setNotice({
        tone: "success",
        message: `${uploads.length} photo${uploads.length === 1 ? "" : "s"} added.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to upload photos.",
      });
    } finally {
      event.target.value = "";
      setIsUploading(false);
    }
  }

  async function handleSharePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []) as File[];
    if (!selectedFiles.length) return;

    const remainingSlots = MAX_SHARE_PHOTOS - sharePhotoUrls.length;
    if (remainingSlots <= 0) {
      setNotice({
        tone: "error",
        message: `You can attach up to ${MAX_SHARE_PHOTOS} photos to this dealer message.`,
      });
      event.target.value = "";
      return;
    }

    const files = selectedFiles.slice(0, remainingSlots);
    setIsUploadingSharePhoto(true);

    try {
      const uploads = await uploadScanPhotoFiles(files);
      const uploadedUrls = uploads
        .map((entry) => entry.url)
        .filter(Boolean)
        .slice(0, remainingSlots);
      setSharePhotoUrls((current) =>
        mergeUniqueStrings([...current, ...uploadedUrls], MAX_SHARE_PHOTOS),
      );
      setNotice({
        tone: "success",
        message:
          uploadedUrls.length === 1
            ? "Photo attached."
            : `${uploadedUrls.length} photos attached.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to attach photo.",
      });
    } finally {
      event.target.value = "";
      setIsUploadingSharePhoto(false);
    }
  }

  function handleRemoveSharePhoto(url: string) {
    setSharePhotoUrls((current) => current.filter((entry) => entry !== url));
  }

  function handleRemovePhoto(url: string) {
    setDraft((current) => ({
      ...current,
      photoUrls: current.photoUrls.filter((entry) => entry !== url),
    }));
  }

  function openServicePhotoStep() {
    setShowServicePhotoStep(true);
  }

  function closeServicePhotoStep() {
    setShowServicePhotoStep(false);
  }

  function openEditor(nextEditor: EditorKey) {
    const isFieldManagerAccess =
      fieldManagerMode || scanAccessMode === "field_manager";
    const enforcedEditor =
      !isFieldManagerAccess &&
      nextEditor !== "usage" &&
      needsUsageUpdateBeforeActions(
        asset,
        pendingUpdate,
        hasCompletedRequiredUsageUpdate,
      )
        ? "usage"
        : nextEditor;

    if (enforcedEditor !== nextEditor && asset) {
      setNotice({ tone: "error", message: requiredUsageCopy(asset) });
    }

    setDraft((current) => {
      const nextDraft = keepCurrentLocation(
        current,
        readQrScanSession(normalizedCode),
      );

      if (!asset) return nextDraft;

      if (
        enforcedEditor === "usage" &&
        (asset.usageMode === "hours" || asset.usageMode === "km")
      ) {
        const stagedHours =
          pendingUpdate.hasUsage && pendingUpdate.hours
            ? pendingUpdate.hours
            : asset.hours !== null
              ? String(Math.round(asset.hours))
              : "";

        return { ...nextDraft, hours: stagedHours };
      }

      if (enforcedEditor === "service") {
        return { ...nextDraft, photoUrls: pendingUpdate.photoUrls };
      }

      if (enforcedEditor === "photos") {
        return { ...nextDraft, photoUrls: pendingUpdate.photoUrls };
      }

      if (enforcedEditor === "notes") {
        return { ...nextDraft, note: "" };
      }

      return nextDraft;
    });

    setShowServiceDetailsStep(false);
    setShowServicePhotoStep(false);
    setActiveEditor(enforcedEditor);
  }

  function closeEditor() {
    setDraft((current) =>
      keepCurrentLocation(current, readQrScanSession(normalizedCode)),
    );
    setShowServiceDetailsStep(false);
    setShowServicePhotoStep(false);
    setActiveEditor(null);
  }

  function skipRequiredUsageUpdate() {
    setDraft((current) =>
      keepCurrentLocation(current, readQrScanSession(normalizedCode)),
    );
    setHasCompletedRequiredUsageUpdate(true);
    setShowServiceDetailsStep(false);
    setShowServicePhotoStep(false);
    setActiveEditor(null);
    setNotice(null);
  }

  function removeShareMap() {
    if (shareLeafletMapRef.current) {
      shareLeafletMapRef.current.remove();
      shareLeafletMapRef.current = null;
    }

    shareMarkerLayerRef.current = null;
    shareMarkersByPartnerRef.current.clear();
  }

  function resetShareFlow() {
    setSharePartnerSearch("");
    setSelectedSharePartnerId("");
    setShareOwnerMessage("");
    setSharePhotoUrls([]);
    setShareLeadStep(null);
    setShareConsentAccepted(false);
  }

  function closeShareModal() {
    if (isSaving || isSendingShareLead || isUploadingSharePhoto) return;
    setIsShareModalOpen(false);
    setSharePartners([]);
    resetShareFlow();
    removeShareMap();
  }

  async function loadSharePartners(searchValue = sharePartnerSearch) {
    setIsLoadingSharePartners(true);

    try {
      const query = searchValue.trim()
        ? `?search=${encodeURIComponent(searchValue.trim())}`
        : "";
      const response = await fetch(
        `/api/scan/assets/${encodeURIComponent(normalizedCode)}/dealer-share${query}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const data = (await response
        .json()
        .catch(() => null)) as PartnerDirectoryApiResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(apiErrorMessage(data, "Failed to load local dealers."));
      }

      const nextPartners = data.partners ?? [];
      setSharePartners(nextPartners);
      setSelectedSharePartnerId((current) => {
        if (!current) return current;
        return nextPartners.some((partner) => partner.userId === current)
          ? current
          : "";
      });
    } catch (error) {
      setSharePartners([]);
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load local dealers.",
      });
    } finally {
      setIsLoadingSharePartners(false);
    }
  }

  function handleShareSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadSharePartners(sharePartnerSearch);
  }

  function handleShareTap() {
    if (!asset) return;

    if (scanAccessMode === "field_manager") {
      setNotice({
        tone: "error",
        message: "Dealer sharing is not available in Field Manager mode.",
      });
      return;
    }

    if (
      needsUsageUpdateBeforeActions(
        asset,
        pendingUpdate,
        hasCompletedRequiredUsageUpdate,
      )
    ) {
      setNotice({ tone: "error", message: requiredUsageCopy(asset) });
      openEditor("usage");
      return;
    }

    const storedSession = readQrScanSession(normalizedCode);
    const hasSessionLocation =
      hasLocationCaptured(draft) || sessionHasLocation(storedSession);

    if (!hasSessionLocation) {
      setNotice({
        tone: "error",
        message: "GPS is required before sending this asset to a dealer.",
      });
      void captureLocation(false);
      return;
    }

    if (!hasLocationCaptured(draft) && sessionHasLocation(storedSession)) {
      setDraft((current) =>
        applySessionLocationToDraft(current, storedSession),
      );
      setLocationState("ready");
      setLocationMessage(sessionLocationMessage(storedSession));
    }

    resetShareFlow();
    setShareOwnerMessage(
      `Please assist with ${asset.title}.${asset.serialNumber ? ` Serial number: ${asset.serialNumber}.` : ""}`,
    );
    setIsShareModalOpen(true);
    setNotice(null);
  }

  function openShareLeadMessage(partner: PartnerDirectoryEntry) {
    setSelectedSharePartnerId(partner.userId);
    setShareLeadStep("message");
    setShareConsentAccepted(false);
    removeShareMap();
  }

  function goBackToShareMap() {
    if (isSendingShareLead || isUploadingSharePhoto) return;
    setShareLeadStep(null);
    setShareConsentAccepted(false);
  }

  function goToShareConsent() {
    if (!selectedSharePartnerId) {
      setNotice({ tone: "error", message: "Choose a dealer before sending." });
      return;
    }

    if (isUploadingSharePhoto) {
      setNotice({
        tone: "error",
        message: "Wait for the photo upload to finish.",
      });
      return;
    }

    setShareConsentAccepted(false);
    setShareLeadStep("consent");
  }

  async function handleSendDealerShareLead() {
    if (!asset) return;

    const selectedPartner = sharePartners.find(
      (partner) => partner.userId === selectedSharePartnerId,
    );

    if (!selectedPartner) {
      setNotice({ tone: "error", message: "Choose a dealer before sending." });
      return;
    }

    if (!shareConsentAccepted) {
      setNotice({
        tone: "error",
        message: "Confirm that the asset may be sent to the dealer.",
      });
      return;
    }

    if (isUploadingSharePhoto) {
      setNotice({
        tone: "error",
        message: "Wait for the photo upload to finish.",
      });
      return;
    }

    if (operatorName.trim().length < 2) {
      setNotice({
        tone: "error",
        message: "Enter your name before sending to a dealer.",
      });
      return;
    }

    const storedSession = readQrScanSession(normalizedCode);
    const shareLatitude =
      pendingUpdate.latitude || draft.latitude || storedSession?.latitude || "";
    const shareLongitude =
      pendingUpdate.longitude ||
      draft.longitude ||
      storedSession?.longitude ||
      "";

    if (!shareLatitude.trim() || !shareLongitude.trim()) {
      setNotice({
        tone: "error",
        message: "GPS is required before sending this asset to a dealer.",
      });
      void captureLocation(false);
      return;
    }

    setIsSendingShareLead(true);

    try {
      const saved = await persistPendingScanUpdate();
      if (!saved) return;

      const response = await fetch(
        `/api/scan/assets/${encodeURIComponent(normalizedCode)}/dealer-share`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partnerUserId: selectedPartner.userId,
            ownerMessage: shareOwnerMessage,
            operatorName: operatorName.trim(),
            latitude: shareLatitude,
            longitude: shareLongitude,
            sharePhotoUrls,
          }),
        },
      );
      const data = (await response
        .json()
        .catch(() => null)) as DealerShareLeadResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(
          apiErrorMessage(data, "Failed to send the asset to the dealer."),
        );
      }

      setIsShareModalOpen(false);
      setActiveEditor(null);
      setIsDone(false);
      setHasCompletedRequiredUsageUpdate(true);
      setSharePartners([]);
      resetShareFlow();
      removeShareMap();
      setNotice({
        tone: "success",
        message: `Dealer request sent to ${dealerPartnerName(selectedPartner)}.`,
      });
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to send the asset to the dealer.",
      });
    } finally {
      setIsSendingShareLead(false);
    }
  }

  async function captureLocation(isAutomatic = false) {
    const storedSession = readQrScanSession(normalizedCode);

    if (isAutomatic && sessionHasLocation(storedSession)) {
      setDraft((current) =>
        applySessionLocationToDraft(current, storedSession),
      );
      setLocationState("ready");
      setLocationMessage(sessionLocationMessage(storedSession));
      return;
    }

    if (typeof window === "undefined" || !window.isSecureContext) {
      setLocationState("error");
      setLocationMessage(
        "Location can only be captured on a secure HTTPS page.",
      );
      return;
    }

    if (!navigator.geolocation) {
      setLocationState("error");
      setLocationMessage("Location is not supported on this device.");
      return;
    }

    setLocationState("capturing");
    setLocationMessage(
      isAutomatic ? "Checking GPS session…" : "Getting GPS location...",
    );

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = String(position.coords.latitude);
          const longitude = String(position.coords.longitude);
          const gpsAccuracyMeters = Number.isFinite(position.coords.accuracy)
            ? String(position.coords.accuracy)
            : "";
          const locationCapturedAtIso = new Date(
            position.timestamp || Date.now(),
          ).toISOString();
          const locationText = GPS_READY_SESSION_MESSAGE;
          const savedSession = updateQrScanSession(
            normalizedCode,
            (current) => ({
              ...current,
              assetId: asset?.id || current.assetId,
              latitude,
              longitude,
              gpsAccuracyMeters,
              locationMessage: locationText,
              locationCapturedAtIso,
            }),
          );
          setDraft((current) => ({ ...current, latitude, longitude }));
          setPendingUpdate((current) => ({
            ...current,
            latitude,
            longitude,
            gpsAccuracyMeters,
            clientCapturedAt: locationCapturedAtIso,
          }));
          setLocationState("ready");
          setLocationMessage(sessionLocationMessage(savedSession));
          if (!isAutomatic && asset)
            setNotice({ tone: "success", message: "Location captured." });
          resolve();
        },
        () => {
          setLocationState("error");
          setLocationMessage(
            "GPS permission is required. Enable location access and capture GPS again.",
          );
          if (!isAutomatic && asset) {
            setNotice({
              tone: "error",
              message:
                "GPS permission is required. Enable location access and capture GPS again.",
            });
          }
          resolve();
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
      );
    });
  }

  function validateDraftForSave(): { ok: boolean; message?: string } {
    if (!asset || !activeEditor)
      return { ok: false, message: "Choose an update first." };

    const persistedAsset = savedAsset ?? asset;

    if (!isFieldManagerMode && operatorName.trim().length < 2) {
      return { ok: false, message: "Enter your name before saving." };
    }

    if (
      !hasLocationCaptured(draft) &&
      !sessionHasLocation(readQrScanSession(normalizedCode))
    ) {
      return {
        ok: false,
        message:
          "Location is required for every QR update. Allow GPS and try again.",
      };
    }

    if (activeEditor === "usage") {
      if (!isMeterUsageMode(asset)) {
        return {
          ok: false,
          message: "This asset does not accept QR usage updates.",
        };
      }

      if (!draft.hours.trim())
        return { ok: false, message: "Enter the current reading." };
      const nextHours = Number(draft.hours);
      if (persistedAsset.hours !== null && nextHours < persistedAsset.hours) {
        return {
          ok: false,
          message:
            asset.usageMode === "km"
              ? "The new kilometre reading cannot be lower than the saved reading."
              : "The new hour reading cannot be lower than the saved reading.",
        };
      }
      return { ok: true };
    }

    if (activeEditor === "service") {
      if (!draft.serviceMode) return { ok: false, message: "Choose a type." };

      const validationServiceCopy = serviceCopyForProfile(
        resolveAssetServiceProfile(asset),
      );

      if (draft.serviceMode === "checked") {
        if (!draft.checkedItems.length && !draft.note.trim()) {
          return {
            ok: false,
            message: "Select what was checked or add notes/problems.",
          };
        }
        return { ok: true };
      }

      if (draft.serviceMode === "serviced") {
        if (!draft.servicedItems.length && !draft.note.trim()) {
          return {
            ok: false,
            message: "Select what was serviced or add notes/problems.",
          };
        }
      }

      if (draft.serviceMode === "repaired") {
        if (!draft.repairDetails.trim()) {
          return { ok: false, message: "Explain exactly what was repaired." };
        }
      }

      if (
        !showServiceDetailsStep &&
        (!draft.serviceCompany.trim() || !draft.mechanicName.trim())
      ) {
        setShowServicePhotoStep(false);
        setShowServiceDetailsStep(true);
        return { ok: false };
      }

      if (!draft.serviceCompany.trim()) {
        return {
          ok: false,
          message: `Enter the ${validationServiceCopy.companyLabel.toLowerCase()}.`,
        };
      }
      if (!draft.mechanicName.trim()) {
        return {
          ok: false,
          message: `Enter the ${validationServiceCopy.mechanicLabel.toLowerCase()}.`,
        };
      }
      return { ok: true };
    }

    if (activeEditor === "photos") {
      if (!draft.photoUrls.length)
        return { ok: false, message: "Upload or take at least one photo." };
      return { ok: true };
    }

    if (activeEditor === "notes") {
      if (!draft.note.trim())
        return { ok: false, message: "Enter a note or problem." };
      return { ok: true };
    }

    return { ok: false, message: "Choose an update first." };
  }

  async function handleSaveUpdate() {
    if (!asset || !activeEditor) return;

    const validation = validateDraftForSave();
    if (!validation.ok) {
      if (validation.message)
        setNotice({ tone: "error", message: validation.message });
      return;
    }

    const storedSession = readQrScanSession(normalizedCode);
    const savedLatitude = draft.latitude || storedSession?.latitude || "";
    const savedLongitude = draft.longitude || storedSession?.longitude || "";
    const savedGpsAccuracyMeters =
      storedSession?.gpsAccuracyMeters || pendingUpdate.gpsAccuracyMeters || "";
    const savedClientCapturedAt =
      storedSession?.locationCapturedAtIso ||
      pendingUpdate.clientCapturedAt ||
      "";

    const withSavedLocation = (update: PendingScanUpdate): PendingScanUpdate => ({
      ...update,
      latitude: savedLatitude || update.latitude,
      longitude: savedLongitude || update.longitude,
      gpsAccuracyMeters: savedGpsAccuracyMeters || update.gpsAccuracyMeters,
      clientCapturedAt: savedClientCapturedAt || update.clientCapturedAt,
    });

    let nextPendingUpdate = withSavedLocation(pendingUpdate);

    if (savedLatitude && savedLongitude) {
      updateQrScanSession(normalizedCode, (current) => ({
        ...current,
        assetId: asset.id,
        latitude: savedLatitude,
        longitude: savedLongitude,
        gpsAccuracyMeters: savedGpsAccuracyMeters || current.gpsAccuracyMeters,
        locationCapturedAtIso:
          savedClientCapturedAt || current.locationCapturedAtIso,
        locationMessage: current.locationMessage || GPS_READY_SESSION_MESSAGE,
      }));
    }

    if (
      activeEditor === "usage" &&
      (asset.usageMode === "hours" || asset.usageMode === "km")
    ) {
      const stagedHours = draft.hours.trim();
      const parsedHours = Number(stagedHours);

      nextPendingUpdate = withSavedLocation({
        ...nextPendingUpdate,
        hours: stagedHours,
        hasUsage: true,
      });
      updateQrScanSession(normalizedCode, (current) => ({
        ...current,
        assetId: asset.id,
        usageMode: asset.usageMode,
        hours: stagedHours,
        hasUsage: true,
        latitude: savedLatitude || current.latitude,
        longitude: savedLongitude || current.longitude,
        gpsAccuracyMeters: savedGpsAccuracyMeters || current.gpsAccuracyMeters,
        locationCapturedAtIso:
          savedClientCapturedAt || current.locationCapturedAtIso,
        locationMessage: current.locationMessage || GPS_READY_SESSION_MESSAGE,
      }));
      setAsset((current) =>
        current ? { ...current, hours: parsedHours } : current,
      );
      setHasCompletedRequiredUsageUpdate(true);
    }

    if (activeEditor === "service") {
      const serviceNote = buildServiceNote(draft);
      const stagedPhotos = mergeUniqueStrings(draft.photoUrls, MAX_QR_PHOTOS);

      nextPendingUpdate = withSavedLocation({
        ...nextPendingUpdate,
        notes: mergeUniqueStrings([...nextPendingUpdate.notes, serviceNote]),
        photoUrls: mergeUniqueStrings(
          [...nextPendingUpdate.photoUrls, ...stagedPhotos],
          MAX_QR_PHOTOS,
        ),
        hasService: true,
        hasPhotos: stagedPhotos.length > 0 || nextPendingUpdate.hasPhotos,
      });

      if (stagedPhotos.length) {
        setAsset((current) =>
          current
            ? {
                ...current,
                photos: mergeUniqueStrings(
                  [...current.photos, ...stagedPhotos],
                  MAX_QR_PHOTOS,
                ),
              }
            : current,
        );
      }
    }

    if (activeEditor === "photos") {
      const stagedPhotos = mergeUniqueStrings(draft.photoUrls, MAX_QR_PHOTOS);

      nextPendingUpdate = withSavedLocation({
        ...nextPendingUpdate,
        photoUrls: mergeUniqueStrings(
          [...nextPendingUpdate.photoUrls, ...stagedPhotos],
          MAX_QR_PHOTOS,
        ),
        hasPhotos: stagedPhotos.length > 0 || nextPendingUpdate.hasPhotos,
      });
      setAsset((current) =>
        current
          ? {
              ...current,
              photos: mergeUniqueStrings(
                [...current.photos, ...stagedPhotos],
                MAX_QR_PHOTOS,
              ),
            }
          : current,
      );
    }

    if (activeEditor === "notes") {
      const noteText = draft.note.trim();

      nextPendingUpdate = withSavedLocation({
        ...nextPendingUpdate,
        notes: mergeUniqueStrings([
          ...nextPendingUpdate.notes,
          `Notes/Problems: ${noteText}`,
        ]),
        hasNotes: true,
      });
    }

    setPendingUpdate(nextPendingUpdate);

    if (isFieldManagerMode) {
      const result = await persistPendingScanUpdate(nextPendingUpdate);
      if (!result) return;
      await redirectAfterFieldManagerServerSave();
      return;
    }

    setDraft({
      ...initialDraft,
      latitude: savedLatitude,
      longitude: savedLongitude,
    });
    setActiveEditor(null);
    setShowServiceDetailsStep(false);
    setShowServicePhotoStep(false);
    setNotice({
      tone: "success",
      message: "Update added. Tap Done to save it to the asset register.",
    });
    setLocationState("ready");
    setLocationMessage(GPS_READY_SESSION_MESSAGE);
  }

  function closeDoneSession() {
    setActiveEditor(null);
    setShowLocationReminder(false);
    setIsDone(true);
    clearQrScanSession(normalizedCode);

    try {
      window.history.replaceState(
        { aim4priceQrDone: true },
        "",
        window.location.href,
      );
    } catch {
      // Ignore history replacement errors.
    }

    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);
  }

  async function persistPendingScanUpdate(
    updateToPersist: PendingScanUpdate = pendingUpdate,
  ): Promise<PersistPendingScanUpdateResult | null> {
    if (!asset) return null;

    if (!hasPendingScanUpdate(updateToPersist)) {
      return { asset, syncedToServer: false };
    }

    const storedSession = readQrScanSession(normalizedCode);
    const storedSessionUsage = sessionUsageForAsset(asset, storedSession);
    const finalLatitude =
      updateToPersist.latitude || draft.latitude || storedSession?.latitude || "";
    const finalLongitude =
      updateToPersist.longitude ||
      draft.longitude ||
      storedSession?.longitude ||
      "";
    const finalGpsAccuracyMeters =
      updateToPersist.gpsAccuracyMeters || storedSession?.gpsAccuracyMeters || "";
    const finalClientCapturedAt =
      updateToPersist.clientCapturedAt ||
      storedSession?.locationCapturedAtIso ||
      new Date().toISOString();
    const finalClientEventId =
      updateToPersist.clientEventId ||
      createOfflineClientEventId("asset-scan-update");
    const shouldSendUsageReading =
      (asset.usageMode === "hours" || asset.usageMode === "km") &&
      (updateToPersist.hasUsage || storedSessionUsage.hasUsage);
    const sessionHours = shouldSendUsageReading
      ? updateToPersist.hours || storedSessionUsage.hours || ""
      : "";
    const operatorNameForSave = isFieldManagerMode
      ? operatorName.trim() || "Field Manager"
      : operatorName.trim();

    if (!isFieldManagerMode && operatorNameForSave.length < 2) {
      setNotice({ tone: "error", message: "Enter your name before saving." });
      return null;
    }

    if (!finalLatitude.trim() || !finalLongitude.trim()) {
      setNotice({
        tone: "error",
        message: "Location is required. Allow GPS before saving.",
      });
      void captureLocation(false);
      return null;
    }

    const endpoint = `/api/scan/assets/${encodeURIComponent(normalizedCode)}/event${fieldManagerQueryString()}`;
    const payload = {
      operatorName: operatorNameForSave,
      hours: sessionHours,
      note: updateToPersist.notes.join("\n\n---\n\n"),
      photoUrls: updateToPersist.photoUrls,
      latitude: scanLocationPayloadText(finalLatitude),
      longitude: scanLocationPayloadText(finalLongitude),
      clientCapturedAt: finalClientCapturedAt,
      gpsAccuracyMeters: scanLocationPayloadText(finalGpsAccuracyMeters),
      clientEventId: finalClientEventId,
    };

    setPendingUpdate((current) => ({
      ...current,
      clientEventId: current.clientEventId || finalClientEventId,
      clientCapturedAt: current.clientCapturedAt || finalClientCapturedAt,
      gpsAccuracyMeters: current.gpsAccuracyMeters || finalGpsAccuracyMeters,
    }));

    setIsSaving(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response
        .json()
        .catch(() => null)) as SaveScanEventResponse | null;

      if (!response.ok || !data?.ok || !data.asset) {
        throw new Error(data?.error ?? "Failed to save the QR update.");
      }

      const savedAssetFromResponse = data.asset;
      const savedSession = updateQrScanSession(normalizedCode, (current) => ({
        ...current,
        assetId: savedAssetFromResponse.id,
        usageMode: savedAssetFromResponse.usageMode,
        hours:
          savedAssetFromResponse.hours !== null &&
          Number.isFinite(savedAssetFromResponse.hours)
            ? String(Math.round(savedAssetFromResponse.hours))
            : current.hours,
        hasUsage:
          current.hasUsage ||
          updateToPersist.hasUsage ||
          storedSessionUsage.hasUsage,
        latitude: finalLatitude || current.latitude,
        longitude: finalLongitude || current.longitude,
        gpsAccuracyMeters: finalGpsAccuracyMeters || current.gpsAccuracyMeters,
        locationCapturedAtIso:
          finalClientCapturedAt || current.locationCapturedAtIso,
        locationMessage: current.locationMessage || GPS_READY_SESSION_MESSAGE,
      }));
      setAsset(savedAssetFromResponse);
      setSavedAsset(savedAssetFromResponse);
      setAssetPreview(savedAssetFromResponse);
      if (updateToPersist.hasUsage || storedSessionUsage.hasUsage) {
        setHasCompletedRequiredUsageUpdate(true);
      }
      setPendingUpdate({
        ...initialPendingUpdate,
        latitude: finalLatitude,
        longitude: finalLongitude,
        gpsAccuracyMeters: finalGpsAccuracyMeters,
        clientCapturedAt: finalClientCapturedAt,
      });
      setDraft(
        applySessionLocationToDraft(
          {
            ...initialDraft,
            latitude: finalLatitude,
            longitude: finalLongitude,
          },
          savedSession,
        ),
      );
      if (finalLatitude && finalLongitude) {
        setLocationState("ready");
        setLocationMessage(sessionLocationMessage(savedSession));
      }
      return { asset: savedAssetFromResponse, syncedToServer: true };
    } catch (error) {
      if (isOfflineNetworkError(error)) {
        await enqueueOfflineMutation({
          id: finalClientEventId,
          kind: "asset-scan-update",
          endpoint,
          payload,
        });
        const nextCount = await getOfflineMutationCount(["asset-scan-update"]);
        setPendingSyncCount(nextCount);
        setPendingUpdate({
          ...initialPendingUpdate,
          latitude: finalLatitude,
          longitude: finalLongitude,
          gpsAccuracyMeters: finalGpsAccuracyMeters,
          clientCapturedAt: finalClientCapturedAt,
        });
        setDraft({
          ...initialDraft,
          latitude: finalLatitude,
          longitude: finalLongitude,
        });
        setLocationState("ready");
        setLocationMessage(GPS_READY_SESSION_MESSAGE);
        setDoneMessage(
          "Saved on this phone. It will sync when signal returns.",
        );
        setNotice({
          tone: "success",
          message: "Saved on this phone. It will sync when signal returns.",
        });
        return { asset, syncedToServer: false };
      }

      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save the QR update.",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDone() {
    if (!asset) {
      closeDoneSession();
      return;
    }

    const result = await persistPendingScanUpdate();

    if (!result) return;

    if (isFieldManagerMode) {
      await redirectAfterFieldManagerServerSave();
      return;
    }

    closeDoneSession();
  }

  const locationReady =
    hasLocationCaptured(draft) ||
    sessionHasLocation(readQrScanSession(normalizedCode));
  const isFieldManagerMode =
    fieldManagerMode || scanAccessMode === "field_manager";
  const usageUpdateRequired =
    !isFieldManagerMode &&
    needsUsageUpdateBeforeActions(
      asset,
      pendingUpdate,
      hasCompletedRequiredUsageUpdate,
    );
  const showFieldManagerUsageAction =
    isFieldManagerMode && isMeterUsageMode(asset);
  const serviceProfile = useMemo(
    () => resolveAssetServiceProfile(asset),
    [asset],
  );
  const checkedOptions = useMemo(
    () => checkedOptionsForProfile(serviceProfile),
    [serviceProfile],
  );
  const servicedOptions = useMemo(
    () => servicedOptionsForProfile(serviceProfile),
    [serviceProfile],
  );
  const serviceCopy = useMemo(
    () => serviceCopyForProfile(serviceProfile),
    [serviceProfile],
  );
  const prePinAsset = assetPreview;
  const hasServiceSelection =
    draft.serviceMode === "checked"
      ? draft.checkedItems.length > 0 || Boolean(draft.note.trim())
      : draft.serviceMode === "serviced"
        ? draft.servicedItems.length > 0 || Boolean(draft.note.trim())
        : draft.serviceMode === "repaired"
          ? Boolean(draft.repairDetails.trim())
          : false;
  const serviceDetailsMissing =
    (draft.serviceMode === "serviced" || draft.serviceMode === "repaired") &&
    showServiceDetailsStep &&
    (!draft.serviceCompany.trim() || !draft.mechanicName.trim());
  const isServicePhotoStep = activeEditor === "service" && showServicePhotoStep;
  const saveBlockedByEmptyDraft =
    activeEditor === "photos"
      ? draft.photoUrls.length === 0
      : activeEditor === "notes"
        ? !draft.note.trim()
        : activeEditor === "service"
          ? !draft.serviceMode || !hasServiceSelection || serviceDetailsMissing
          : false;
  const canPressSave = isServicePhotoStep
    ? !isSaving && !isUploading
    : !isSaving && !isUploading && !saveBlockedByEmptyDraft;
  const saveButtonLabel = isSaving
    ? "Saving…"
    : isServicePhotoStep
      ? "Done"
      : activeEditor === "photos" && !draft.photoUrls.length
        ? "Add photos"
        : activeEditor === "notes" && !draft.note.trim()
          ? "Add note"
          : activeEditor === "service" && !draft.serviceMode
            ? "Choose type"
            : activeEditor === "service" && !hasServiceSelection
              ? draft.serviceMode === "checked"
                ? "Select items"
                : draft.serviceMode === "repaired"
                  ? "Explain repair"
                  : "Select items"
              : serviceDetailsMissing
                ? "Complete details"
                : activeEditor === "service" &&
                    (draft.serviceMode === "serviced" ||
                      draft.serviceMode === "repaired") &&
                    !showServiceDetailsStep
                  ? "Next"
                  : activeEditor === "usage" && usageUpdateRequired
                    ? "Continue"
                    : "Add update";
  const selectedSharePartner = useMemo(
    () =>
      sharePartners.find(
        (partner) => partner.userId === selectedSharePartnerId,
      ) ?? null,
    [sharePartners, selectedSharePartnerId],
  );
  const pageClassName = `${styles.page} ${isFieldManagerMode ? styles.fieldManagerMobileSurface : ""}`;
  const canUseDealerShare = !isFieldManagerMode;
  const selectedSharePartnerPhoneHref = selectedSharePartner
    ? normalizePhoneHref(selectedSharePartner.phone)
    : "";
  const selectedSharePartnerEmailHref = selectedSharePartner
    ? normalizeEmailHref(selectedSharePartner.email)
    : "";
  const selectedSharePartnerWebsiteHref = selectedSharePartner
    ? normalizeWebsiteHref(selectedSharePartner.websiteUrl)
    : "";
  const sharePartnersWithCoordinates = useMemo(
    () => sharePartners.filter(hasDealerPartnerCoordinates),
    [sharePartners],
  );

  if (isDone) {
    return (
      <main className={pageClassName}>
        <section className={styles.thankYouScreen}>
          <h1>Thank you.</h1>
          {doneMessage ? <p>{doneMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className={pageClassName}>
      <div className={styles.shell}>
        {notice ? (
          <div
            className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}
          >
            {notice.message}
          </div>
        ) : null}

        {pendingSyncCount > 0 ? (
          <div className={`${styles.notice} ${styles.noticeSuccess}`}>
            {pendingSyncCount === 1
              ? "1 saved phone update will sync when signal returns."
              : `${pendingSyncCount} saved phone updates will sync when signal returns.`}
          </div>
        ) : null}

        {!asset && !isUnavailable && !assetOpenError && isFieldManagerMode ? (
          <section className={styles.assetOpenedCard}>
            <div className={styles.assetScanTitleBlock}>
              <span>Field Manager asset</span>
              <h1>{prePinAsset?.title || "Opening asset"}</h1>
              <p>
                Checking your Field Manager access. No farm PIN or scanner name
                is required.
              </p>
            </div>
          </section>
        ) : null}

        {!asset && !isUnavailable && !assetOpenError && !isFieldManagerMode ? (
          <section
            className={`${styles.pinCard} ${!locationReady ? styles.pinCardBlocked : ""}`}
          >
            <div className={styles.assetScanTitleBlock}>
              <span>Asset QR for</span>
              <h1>{prePinAsset?.title || "Asset scan"}</h1>
              <p>{assetScanMeta(prePinAsset)}</p>
            </div>

            <form className={styles.pinForm} onSubmit={handlePinSubmit}>
              <label className={styles.field}>
                <span>QR scan PIN</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="4 to 8 digits"
                  value={pin}
                  onChange={(event) =>
                    setPin(normalizePinInput(event.target.value))
                  }
                  disabled={isSubmittingPin || isLoadingAsset || !locationReady}
                />
              </label>

              <label className={styles.field}>
                <span>Your name</span>
                <input
                  autoComplete="name"
                  placeholder="Name of person scanning"
                  value={operatorName}
                  onChange={(event) =>
                    setOperatorName(normalizeOperatorName(event.target.value))
                  }
                  disabled={isSubmittingPin || isLoadingAsset || !locationReady}
                />
              </label>

              {locationReady ? (
                <div
                  className={`${styles.locationGate} ${styles.locationGateReady}`}
                >
                  <div>
                    <strong>Location ready</strong>
                    <span>{locationMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void captureLocation(false)}
                    disabled={locationState === "capturing"}
                  >
                    {locationState === "capturing"
                      ? "Capturing..."
                      : "Recapture GPS"}
                  </button>
                </div>
              ) : null}

              <button
                type="submit"
                className={styles.primaryButton}
                disabled={
                  isSubmittingPin ||
                  isLoadingAsset ||
                  !locationReady ||
                  pin.length < 4 ||
                  operatorName.trim().length < 2
                }
              >
                {isSubmittingPin || isLoadingAsset
                  ? "Opening…"
                  : "Unlock asset"}
              </button>
            </form>

            {!locationReady ? (
              <div
                className={styles.locationPromptBackdrop}
                role="dialog"
                aria-modal="true"
                aria-labelledby="asset-location-title"
              >
                <div className={styles.locationPromptCard}>
                  <div className={styles.locationPromptIcon} aria-hidden="true">
                    ⌖
                  </div>
                  <h2 id="asset-location-title">Keep location on</h2>
                  <p>
                    Every QR save stores a GPS point automatically. Allow
                    location access on this phone before saving updates.
                  </p>
                  <span>{locationMessage}</span>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void captureLocation(false)}
                    disabled={locationState === "capturing"}
                  >
                    {locationState === "capturing"
                      ? "Capturing..."
                      : "Continue"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {isUnavailable || assetOpenError ? (
          <section className={styles.unavailableCard}>
            <h2>This asset could not be opened</h2>
            <p>
              {assetOpenError ||
                (isFieldManagerMode
                  ? "Could not open this asset. Your Field Manager session may not have access to this asset. Please go back and try again."
                  : "Check the QR code, or ask the owner to confirm that the farm scan PIN is enabled for this account.")}
            </p>
            <div className={styles.centerStack}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={goBackFromAssetError}
              >
                Back
              </button>
              {isFieldManagerMode ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => void loadUnlockedAsset()}
                  disabled={isLoadingAsset}
                >
                  {isLoadingAsset ? "Trying…" : "Try again"}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {asset ? (
          <>
            <section className={styles.assetOpenedCard}>
              <div
                className={`${styles.assetScanTitleBlock} ${
                  isFieldManagerMode ? styles.fieldManagerAssetTitleBlock : ""
                }`}
              >
                {isFieldManagerMode ? null : <span>Asset QR update</span>}
                <h1>{asset.title}</h1>
                {isFieldManagerMode ? null : <p>{assetScanMeta(asset)}</p>}
              </div>
              <button
                type="button"
                className={`${styles.gpsButton} ${locationReady ? styles.gpsButtonReady : ""} ${locationState === "error" ? styles.gpsButtonError : ""}`}
                onClick={() => void captureLocation(false)}
                disabled={locationState === "capturing" || isSaving}
              >
                <LocationIcon className={styles.gpsButtonIcon} />
                <span>
                  {locationReady
                    ? "GPS ready"
                    : locationState === "capturing"
                      ? "Getting GPS"
                      : "GPS required"}
                </span>
              </button>
            </section>

            {usageUpdateRequired ? (
              <section className={styles.usageGateCard}>
                <div className={styles.usageGateTitleBlock}>
                  <span>Required first</span>
                  <h2>{requiredUsageTitle(asset)}</h2>
                  <p>{requiredUsageCopy(asset)}</p>
                </div>
                <div className={styles.usageGateReadingCard}>
                  <span>Last recorded</span>
                  <strong>{formatUsage(savedAsset ?? asset)}</strong>
                </div>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => openEditor("usage")}
                  disabled={isSaving || isUploading}
                >
                  {requiredUsageButtonLabel(asset)}
                </button>
              </section>
            ) : (
              <>
                <section className={styles.actionGrid}>
                  {canUseDealerShare ? (
                    <button
                      type="button"
                      className={styles.actionCard}
                      onClick={handleShareTap}
                    >
                      <span className={styles.actionIconWrap}>
                        <ShareIcon className={styles.actionIcon} />
                      </span>
                      <span className={styles.actionTextBlock}>
                        <strong>Share</strong>
                        <small>Dealer help</small>
                      </span>
                    </button>
                  ) : null}

                  {showFieldManagerUsageAction ? (
                    <button
                      type="button"
                      className={styles.actionCard}
                      onClick={() => openEditor("usage")}
                    >
                      <span className={styles.actionIconWrap}>
                        <MeterIcon className={styles.actionIcon} />
                      </span>
                      <span className={styles.actionTextBlock}>
                        <strong>Usage</strong>
                        <small>
                          {asset.usageMode === "km"
                            ? "Update kilometres"
                            : "Update hours"}
                        </small>
                      </span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className={styles.actionCard}
                    onClick={() => openEditor("service")}
                  >
                    <span className={styles.actionIconWrap}>
                      <WrenchIcon className={styles.actionIcon} />
                    </span>
                    <span className={styles.actionTextBlock}>
                      <strong>Maintenance</strong>
                      <small className={styles.actionSubtitleNoWrap}>
                        {buildEditorSummary("service", asset)}
                      </small>
                    </span>
                  </button>

                  <button
                    type="button"
                    className={styles.actionCard}
                    onClick={() => openEditor("photos")}
                  >
                    <span className={styles.actionIconWrap}>
                      <CameraIcon className={styles.actionIcon} />
                    </span>
                    <span className={styles.actionTextBlock}>
                      <strong>Photos</strong>
                      <small>{buildEditorSummary("photos", asset)}</small>
                    </span>
                  </button>

                  {isFieldManagerMode ? (
                    <button
                      type="button"
                      className={styles.actionCard}
                      onClick={() => openEditor("notes")}
                    >
                      <span className={styles.actionIconWrap}>
                        <NoteIcon className={styles.actionIcon} />
                      </span>
                      <span className={styles.actionTextBlock}>
                        <strong>Notes</strong>
                        <small>{buildEditorSummary("notes", asset)}</small>
                      </span>
                    </button>
                  ) : null}
                </section>

                <button
                  type="button"
                  className={styles.doneButton}
                  onClick={() => void handleDone()}
                  disabled={isSaving || isUploading}
                >
                  {isSaving && hasPendingScanUpdate(pendingUpdate)
                    ? "Saving…"
                    : "Done"}
                </button>
              </>
            )}
          </>
        ) : null}
      </div>

      {asset && showLocationReminder && !activeEditor ? (
        <div className={styles.locationReminderOverlay}>
          <div className={styles.modalBackdrop} />
          <div
            className={styles.locationReminderModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-reminder-title"
          >
            <div className={styles.locationReminderIcon}>
              <LocationIcon className={styles.locationReminderSvg} />
            </div>
            <h3 id="location-reminder-title">Keep location on</h3>
            <p>
              {isFieldManagerMode
                ? "Every field update stores a GPS point automatically. Allow location access on this phone before saving updates."
                : "Every QR save stores a GPS point automatically. Allow location access on this phone before saving updates."}
            </p>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setShowLocationReminder(false)}
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {asset && isShareModalOpen && canUseDealerShare ? (
        <div className={styles.shareOverlay}>
          <div className={styles.modalBackdrop} onClick={closeShareModal} />
          <section
            className={styles.shareModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
          >
            <header className={styles.shareHeader}>
              <div className={styles.shareTitleBlock}>
                <span>Dealer help</span>
                <h3 id="share-modal-title">
                  {shareLeadStep === "consent"
                    ? "Confirm request"
                    : shareLeadStep === "message"
                      ? "Message to dealer"
                      : "Get assistance"}
                </h3>
                <p>Get parts quotes, repair help or dealer support.</p>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={closeShareModal}
                aria-label="Close dealer share"
              >
                <CloseIcon className={styles.closeIcon} />
              </button>
            </header>

            {!shareLeadStep ? (
              <div className={styles.shareBody}>
                <form
                  className={styles.shareSearchBar}
                  onSubmit={handleShareSearchSubmit}
                >
                  <input
                    type="search"
                    placeholder="Search dealer, town, province or brand"
                    value={sharePartnerSearch}
                    onChange={(event) =>
                      setSharePartnerSearch(event.target.value)
                    }
                  />
                  <button
                    type="submit"
                    className={styles.secondaryButton}
                    disabled={isLoadingSharePartners}
                  >
                    {isLoadingSharePartners ? "Loading…" : "Search"}
                  </button>
                </form>

                <div className={styles.shareMapStage}>
                  <div className={styles.shareMapShell}>
                    {isLoadingSharePartners &&
                    !sharePartnersWithCoordinates.length ? (
                      <div className={styles.shareMapFallback}>
                        Loading approved dealers…
                      </div>
                    ) : sharePartnersWithCoordinates.length ? (
                      <div
                        ref={shareMapElementRef}
                        className={styles.shareMapCanvas}
                        aria-label="Dealer map"
                      />
                    ) : (
                      <div className={styles.shareMapFallback}>
                        {!sharePartners.length
                          ? "No approved dealers found. Try a wider search."
                          : "Map pins are not available for the current dealer results."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : shareLeadStep === "message" && selectedSharePartner ? (
              <>
                <div className={styles.shareBody}>
                  <div className={styles.shareSelectedPanel}>
                    <div>
                      <span>Dealer selected</span>
                      <strong>{dealerPartnerName(selectedSharePartner)}</strong>
                      <small>
                        {dealerPartnerAddress(selectedSharePartner) ||
                          dealerPartnerLocation(selectedSharePartner)}
                      </small>
                    </div>
                  </div>

                  <div className={styles.shareContactList}>
                    {selectedSharePartner.phone &&
                    selectedSharePartnerPhoneHref ? (
                      <a href={selectedSharePartnerPhoneHref}>
                        Call {selectedSharePartner.phone}
                      </a>
                    ) : null}
                    {selectedSharePartner.email &&
                    selectedSharePartnerEmailHref ? (
                      <a href={selectedSharePartnerEmailHref}>
                        Email {selectedSharePartner.email}
                      </a>
                    ) : null}
                    {selectedSharePartner.websiteUrl &&
                    selectedSharePartnerWebsiteHref ? (
                      <a
                        href={selectedSharePartnerWebsiteHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {formatWebsiteDisplay(selectedSharePartner.websiteUrl)}
                      </a>
                    ) : null}
                  </div>

                  <label
                    className={`${styles.field} ${styles.shareMessageField}`}
                  >
                    <span>Message to dealer</span>
                    <textarea
                      value={shareOwnerMessage}
                      onChange={(event) =>
                        setShareOwnerMessage(event.target.value.slice(0, 1600))
                      }
                      placeholder="Example: Please quote repair help or replacement parts for this asset."
                    />
                  </label>

                  <div className={styles.sharePhotoPanel}>
                    <button
                      type="button"
                      className={styles.sharePhotoButton}
                      onClick={() => sharePhotoInputRef.current?.click()}
                      disabled={
                        isSaving || isSendingShareLead || isUploadingSharePhoto
                      }
                    >
                      <span className={styles.sharePhotoButtonIcon}>
                        <CameraIcon className={styles.sharePhotoButtonSvg} />
                      </span>
                      <span>
                        <strong>
                          {sharePhotoUrls.length
                            ? "Add photos"
                            : "Attach photos"}
                        </strong>
                        <small>
                          {isUploadingSharePhoto
                            ? "Uploading…"
                            : `${sharePhotoUrls.length} / ${MAX_SHARE_PHOTOS}`}
                        </small>
                      </span>
                    </button>
                    <input
                      ref={sharePhotoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className={styles.hiddenFileInput}
                      onChange={handleSharePhotoChange}
                      disabled={
                        isSaving || isSendingShareLead || isUploadingSharePhoto
                      }
                    />

                    {sharePhotoUrls.length ? (
                      <div className={styles.sharePhotoPreviewGrid}>
                        {sharePhotoUrls.map((url, index) => (
                          <article
                            key={`${url}-${index}`}
                            className={styles.sharePhotoPreviewCard}
                          >
                            <img
                              src={url}
                              alt={`Attached dealer photo ${index + 1}`}
                            />
                            <div>
                              <strong>Photo attached</strong>
                              <span>Saved under this message.</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveSharePhoto(url)}
                              disabled={
                                isSaving ||
                                isSendingShareLead ||
                                isUploadingSharePhoto
                              }
                            >
                              Remove
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <footer className={styles.shareFooter}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={goBackToShareMap}
                    disabled={
                      isSendingShareLead || isSaving || isUploadingSharePhoto
                    }
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={goToShareConsent}
                    disabled={
                      isSendingShareLead || isSaving || isUploadingSharePhoto
                    }
                  >
                    Next
                  </button>
                </footer>
              </>
            ) : shareLeadStep === "consent" && selectedSharePartner ? (
              <>
                <div className={styles.shareBody}>
                  <div className={styles.shareStepHeader}>
                    <strong>{dealerPartnerName(selectedSharePartner)}</strong>
                    <span>
                      The asset will be sent as a replacement quote / dealer
                      help lead.
                    </span>
                  </div>

                  <div className={styles.sharePopiaBox}>
                    <strong>Information included</strong>
                    <p>
                      Asset details, latest QR update, serial number, valuation
                      summary, main photos
                      {sharePhotoUrls.length ? ", attached photos" : ""} and
                      relevant documents will be shared with this dealer.
                    </p>
                  </div>

                  <label className={styles.shareConsentCheck}>
                    <input
                      type="checkbox"
                      checked={shareConsentAccepted}
                      onChange={(event) =>
                        setShareConsentAccepted(event.target.checked)
                      }
                    />
                    <span>
                      I confirm this asset may be sent to the selected dealer
                      for help.
                    </span>
                  </label>
                </div>
                <footer className={styles.shareFooter}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setShareLeadStep("message")}
                    disabled={
                      isSendingShareLead || isSaving || isUploadingSharePhoto
                    }
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void handleSendDealerShareLead()}
                    disabled={
                      isSendingShareLead ||
                      isSaving ||
                      isUploadingSharePhoto ||
                      !shareConsentAccepted
                    }
                  >
                    {isSendingShareLead || isSaving
                      ? "Sending…"
                      : isUploadingSharePhoto
                        ? "Uploading…"
                        : "Send to dealer"}
                  </button>
                </footer>
              </>
            ) : (
              <div className={styles.shareBody}>
                <div className={styles.shareEmptyState}>
                  Choose a dealer again before sending.
                </div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={goBackToShareMap}
                >
                  Back to dealers
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {asset && activeEditor ? (
        <div className={styles.editorOverlay}>
          <div
            className={`${styles.editorCard} ${activeEditor && activeEditor !== "usage" ? styles.actionEditorCard : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-editor-title"
          >
            <div className={styles.editorHeader}>
              <div className={styles.editorTitleBlock}>
                <h3 id="scan-editor-title">
                  {activeEditor === "usage"
                    ? asset.usageMode === "km"
                      ? "Capture the latest kilometres"
                      : "Capture the latest hours"
                    : activeEditor === "service"
                      ? showServicePhotoStep
                        ? "Photos"
                        : draft.serviceMode === "checked"
                          ? serviceCopy.checkedTitle
                          : draft.serviceMode === "serviced"
                            ? showServiceDetailsStep
                              ? "Service details"
                              : serviceCopy.servicedTitle
                            : draft.serviceMode === "repaired"
                              ? showServiceDetailsStep
                                ? "Repairer details"
                                : serviceCopy.repairedTitle
                              : "Maintenance"
                      : activeEditor === "notes"
                        ? "Notes"
                        : "Photos"}
                </h3>
                <p>
                  {activeEditor === "usage"
                    ? "Use the latest reading shown on the machine."
                    : activeEditor === "service"
                      ? showServicePhotoStep
                        ? "Add clear photos."
                        : draft.serviceMode === "checked"
                          ? serviceCopy.checkedPrompt
                          : draft.serviceMode === "serviced"
                            ? showServiceDetailsStep
                              ? serviceCopy.detailsSubheader
                              : serviceCopy.servicedPrompt
                            : draft.serviceMode === "repaired"
                              ? showServiceDetailsStep
                                ? serviceCopy.detailsSubheader
                                : serviceCopy.repairedPrompt
                              : "Choose update type."
                      : activeEditor === "notes"
                        ? "Issues & Problems"
                        : "Add clear photos."}
                </p>
              </div>

              <button
                type="button"
                className={styles.iconButton}
                onClick={closeEditor}
                aria-label="Close editor"
              >
                <CloseIcon className={styles.closeIcon} />
              </button>
            </div>

            <div className={styles.editorBody}>
              {activeEditor === "usage" && isMeterUsageMode(asset) ? (
                <div className={styles.centerStack}>
                  <label className={styles.field}>
                    <span>{usageModalLabel(asset)}</span>
                    <input
                      className={styles.largeInput}
                      inputMode="numeric"
                      placeholder={usagePlaceholder(asset)}
                      value={draft.hours}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          hours: normalizeIntegerInput(event.target.value),
                        }))
                      }
                      disabled={isSaving}
                    />
                  </label>
                  <p className={styles.helperText}>
                    Current saved reading: {formatUsage(asset)}
                  </p>
                </div>
              ) : null}

              {activeEditor === "service" ? (
                showServicePhotoStep ? (
                  <div
                    className={`${styles.modalStack} ${styles.servicePhotoStep}`}
                  >
                    <div className={styles.servicePanel}>
                      <div className={styles.serviceSectionHeader}>
                        <strong>Photos</strong>
                        <small>Add clear photos to this record.</small>
                      </div>

                      <div className={styles.mediaChoiceGrid}>
                        <button
                          type="button"
                          className={styles.mediaButton}
                          onClick={() => galleryInputRef.current?.click()}
                          disabled={
                            isUploading ||
                            isSaving ||
                            draft.photoUrls.length >= MAX_QR_PHOTOS
                          }
                        >
                          <span className={styles.mediaButtonIcon}>
                            <UploadIcon className={styles.mediaButtonSvg} />
                          </span>
                          <span>
                            <strong>Upload</strong>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.mediaButton}
                          onClick={() => cameraInputRef.current?.click()}
                          disabled={
                            isUploading ||
                            isSaving ||
                            draft.photoUrls.length >= MAX_QR_PHOTOS
                          }
                        >
                          <span className={styles.mediaButtonIcon}>
                            <CameraIcon className={styles.mediaButtonSvg} />
                          </span>
                          <span>
                            <strong>Take photo</strong>
                          </span>
                        </button>
                      </div>

                      <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className={styles.hiddenFileInput}
                        onChange={handleUploadChange}
                        disabled={isUploading || isSaving}
                      />
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className={styles.hiddenFileInput}
                        onChange={handleUploadChange}
                        disabled={isUploading || isSaving}
                      />

                      <p className={styles.helperText}>
                        {isUploading
                          ? "Uploading…"
                          : `${draft.photoUrls.length} / ${MAX_QR_PHOTOS} photos`}
                      </p>

                      {draft.photoUrls.length ? (
                        <div className={styles.photoGrid}>
                          {draft.photoUrls.map((url, index) => (
                            <article
                              key={`${url}-${index}`}
                              className={styles.photoCard}
                            >
                              <img
                                src={url}
                                alt={`Maintenance photo ${index + 1}`}
                                className={styles.photoImage}
                              />
                              <button
                                type="button"
                                className={styles.removePhotoButton}
                                onClick={() => handleRemovePhoto(url)}
                                disabled={isSaving}
                              >
                                Remove
                              </button>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.servicePhotoEmptyState}>
                          <CameraIcon
                            className={styles.servicePhotoEmptyIcon}
                          />
                          <strong>No photos yet.</strong>
                          <span>Add photos above.</span>
                        </div>
                      )}

                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={closeServicePhotoStep}
                        disabled={isSaving || isUploading}
                      >
                        {showServiceDetailsStep
                          ? "Back to details"
                          : "Back to maintenance"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.modalStack}>
                    <div
                      className={`${styles.serviceModeGrid} ${draft.serviceMode ? styles.serviceModeGridLocked : ""}`}
                    >
                      {!draft.serviceMode ? (
                        <>
                          <button
                            type="button"
                            className={styles.serviceModeCard}
                            onClick={() => {
                              setShowServiceDetailsStep(false);
                              setShowServicePhotoStep(false);
                              setDraft((current) => ({
                                ...current,
                                serviceMode: "checked",
                                servicedItems: [],
                                repairDetails: "",
                                serviceCompany: "",
                                mechanicName: "",
                              }));
                            }}
                            disabled={isSaving}
                          >
                            <span className={styles.serviceModeIcon}>
                              <CheckCircleIcon
                                className={styles.serviceModeSvg}
                              />
                            </span>
                            <span className={styles.serviceModeText}>
                              <strong>Checked</strong>
                              <small>{serviceCopy.checkedDescription}</small>
                            </span>
                          </button>

                          <button
                            type="button"
                            className={styles.serviceModeCard}
                            onClick={() => {
                              setShowServiceDetailsStep(false);
                              setShowServicePhotoStep(false);
                              setDraft((current) => ({
                                ...current,
                                serviceMode: "serviced",
                                checkedItems: [],
                                repairDetails: "",
                              }));
                            }}
                            disabled={isSaving}
                          >
                            <span className={styles.serviceModeIcon}>
                              <WrenchIcon className={styles.serviceModeSvg} />
                            </span>
                            <span className={styles.serviceModeText}>
                              <strong>Serviced</strong>
                              <small>{serviceCopy.servicedDescription}</small>
                            </span>
                          </button>

                          <button
                            type="button"
                            className={styles.serviceModeCard}
                            onClick={() => {
                              setShowServiceDetailsStep(false);
                              setShowServicePhotoStep(false);
                              setDraft((current) => ({
                                ...current,
                                serviceMode: "repaired",
                                checkedItems: [],
                                servicedItems: [],
                              }));
                            }}
                            disabled={isSaving}
                          >
                            <span className={styles.serviceModeIcon}>
                              <RepairIcon className={styles.serviceModeSvg} />
                            </span>
                            <span className={styles.serviceModeText}>
                              <strong>Repaired</strong>
                              <small>{serviceCopy.repairedDescription}</small>
                            </span>
                          </button>
                        </>
                      ) : (
                        <div
                          className={`${styles.serviceModeCard} ${styles.serviceModeCardActive} ${styles.serviceModeCardLocked}`}
                        >
                          <span className={styles.serviceModeIcon}>
                            {draft.serviceMode === "checked" ? (
                              <CheckCircleIcon
                                className={styles.serviceModeSvg}
                              />
                            ) : draft.serviceMode === "repaired" ? (
                              <RepairIcon className={styles.serviceModeSvg} />
                            ) : (
                              <WrenchIcon className={styles.serviceModeSvg} />
                            )}
                          </span>
                          <span className={styles.serviceModeText}>
                            <strong>
                              {draft.serviceMode === "checked"
                                ? "Checked"
                                : draft.serviceMode === "repaired"
                                  ? "Repaired"
                                  : "Serviced"}
                            </strong>
                            <small>
                              {draft.serviceMode === "checked"
                                ? "Inspection record"
                                : draft.serviceMode === "repaired"
                                  ? "Repair record"
                                  : "Service record"}
                            </small>
                          </span>
                        </div>
                      )}
                    </div>

                    {draft.serviceMode === "checked" ? (
                      <div className={styles.servicePanel}>
                        <div className={styles.serviceSectionHeader}>
                          <strong>{serviceCopy.checkedHeader}</strong>
                          <small>{serviceCopy.checkedSubheader}</small>
                        </div>

                        <div className={styles.optionList}>
                          {checkedOptions.map((option) => {
                            const selected = draft.checkedItems.includes(
                              option.label,
                            );

                            return (
                              <button
                                type="button"
                                key={option.label}
                                className={`${styles.listOptionButton} ${selected ? styles.listOptionActive : ""}`}
                                onClick={() =>
                                  setDraft((current) => ({
                                    ...current,
                                    checkedItems: toggleValue(
                                      current.checkedItems,
                                      option.label,
                                    ),
                                  }))
                                }
                                disabled={isSaving}
                              >
                                <span className={styles.listOptionText}>
                                  <strong>{option.label}</strong>
                                  <small>{option.description}</small>
                                </span>
                                <span className={styles.listOptionCheck}>
                                  {selected ? "✓" : ""}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {draft.checkedItems.length ? (
                          <p className={styles.selectedSummary}>
                            {draft.checkedItems.length} checked item
                            {draft.checkedItems.length === 1 ? "" : "s"}{" "}
                            selected.
                          </p>
                        ) : null}

                        <label className={styles.field}>
                          <span>Notes/Problems</span>
                          <textarea
                            placeholder={serviceCopy.checkedNotePlaceholder}
                            value={draft.note}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                note: event.target.value.slice(0, 1600),
                              }))
                            }
                            disabled={isSaving}
                          />
                        </label>

                        <button
                          type="button"
                          className={styles.maintenancePhotoButton}
                          onClick={openServicePhotoStep}
                          disabled={isSaving || isUploading}
                        >
                          <span className={styles.maintenancePhotoIcon}>
                            <CameraIcon
                              className={styles.maintenancePhotoIconSvg}
                            />
                          </span>
                          <span className={styles.maintenancePhotoText}>
                            <strong>
                              {draft.photoUrls.length ? "Photos" : "Add photos"}
                            </strong>
                            <small>
                              {draft.photoUrls.length
                                ? `${draft.photoUrls.length} photo${draft.photoUrls.length === 1 ? "" : "s"} ready for this record.`
                                : "Optional."}
                            </small>
                          </span>
                        </button>
                      </div>
                    ) : null}

                    {draft.serviceMode === "serviced" ? (
                      <div className={styles.servicePanel}>
                        {!showServiceDetailsStep ? (
                          <>
                            <div className={styles.serviceSectionHeader}>
                              <strong>{serviceCopy.servicedHeader}</strong>
                              <small>{serviceCopy.servicedSubheader}</small>
                            </div>

                            <div className={styles.optionList}>
                              {servicedOptions.map((option) => {
                                const selected = draft.servicedItems.includes(
                                  option.label,
                                );

                                return (
                                  <button
                                    type="button"
                                    key={option.label}
                                    className={`${styles.listOptionButton} ${selected ? styles.listOptionActive : ""}`}
                                    onClick={() =>
                                      setDraft((current) => ({
                                        ...current,
                                        servicedItems: toggleValue(
                                          current.servicedItems,
                                          option.label,
                                        ),
                                      }))
                                    }
                                    disabled={isSaving}
                                  >
                                    <span className={styles.listOptionText}>
                                      <strong>{option.label}</strong>
                                      <small>{option.description}</small>
                                    </span>
                                    <span className={styles.listOptionCheck}>
                                      {selected ? "✓" : ""}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {draft.servicedItems.length ? (
                              <p className={styles.selectedSummary}>
                                {draft.servicedItems.length} serviced item
                                {draft.servicedItems.length === 1 ? "" : "s"}{" "}
                                selected.
                              </p>
                            ) : null}

                            <label className={styles.field}>
                              <span>Notes/Problems</span>
                              <textarea
                                placeholder={
                                  serviceCopy.servicedNotePlaceholder
                                }
                                value={draft.note}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    note: event.target.value.slice(0, 1600),
                                  }))
                                }
                                disabled={isSaving}
                              />
                            </label>

                            <button
                              type="button"
                              className={styles.maintenancePhotoButton}
                              onClick={openServicePhotoStep}
                              disabled={isSaving || isUploading}
                            >
                              <span className={styles.maintenancePhotoIcon}>
                                <CameraIcon
                                  className={styles.maintenancePhotoIconSvg}
                                />
                              </span>
                              <span className={styles.maintenancePhotoText}>
                                <strong>
                                  {draft.photoUrls.length
                                    ? "Photos"
                                    : "Add photos"}
                                </strong>
                                <small>
                                  {draft.photoUrls.length
                                    ? `${draft.photoUrls.length} photo${draft.photoUrls.length === 1 ? "" : "s"} ready for this record.`
                                    : "Optional."}
                                </small>
                              </span>
                            </button>
                          </>
                        ) : (
                          <div className={styles.serviceDetailsCard}>
                            <div className={styles.serviceSectionHeader}>
                              <strong>{serviceCopy.detailsHeader}</strong>
                              <small>{serviceCopy.detailsSubheader}</small>
                            </div>

                            {draft.servicedItems.length ? (
                              <p className={styles.selectedSummary}>
                                Selected: {draft.servicedItems.join(", ")}
                              </p>
                            ) : null}

                            <label className={styles.field}>
                              <span>{serviceCopy.companyLabel}</span>
                              <input
                                placeholder={serviceCopy.companyPlaceholder}
                                value={draft.serviceCompany}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    serviceCompany: event.target.value.slice(
                                      0,
                                      120,
                                    ),
                                  }))
                                }
                                disabled={isSaving}
                              />
                            </label>
                            <label className={styles.field}>
                              <span>{serviceCopy.mechanicLabel}</span>
                              <input
                                placeholder={serviceCopy.mechanicPlaceholder}
                                value={draft.mechanicName}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    mechanicName: event.target.value.slice(
                                      0,
                                      120,
                                    ),
                                  }))
                                }
                                disabled={isSaving}
                              />
                            </label>

                            <button
                              type="button"
                              className={styles.maintenancePhotoButton}
                              onClick={openServicePhotoStep}
                              disabled={isSaving || isUploading}
                            >
                              <span className={styles.maintenancePhotoIcon}>
                                <CameraIcon
                                  className={styles.maintenancePhotoIconSvg}
                                />
                              </span>
                              <span className={styles.maintenancePhotoText}>
                                <strong>
                                  {draft.photoUrls.length
                                    ? "Photos"
                                    : "Add photos"}
                                </strong>
                                <small>
                                  {draft.photoUrls.length
                                    ? `${draft.photoUrls.length} photo${draft.photoUrls.length === 1 ? "" : "s"} ready for this record.`
                                    : "Optional."}
                                </small>
                              </span>
                            </button>

                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() => setShowServiceDetailsStep(false)}
                              disabled={isSaving}
                            >
                              Back to service items
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {draft.serviceMode === "repaired" ? (
                      <div className={styles.servicePanel}>
                        {!showServiceDetailsStep ? (
                          <>
                            <div className={styles.serviceSectionHeader}>
                              <strong>{serviceCopy.repairedHeader}</strong>
                              <small>{serviceCopy.repairedSubheader}</small>
                            </div>

                            <label className={styles.field}>
                              <span>Repair details</span>
                              <textarea
                                className={styles.mainNoteInput}
                                placeholder={
                                  serviceCopy.repairedNotePlaceholder
                                }
                                value={draft.repairDetails}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    repairDetails: event.target.value.slice(
                                      0,
                                      1600,
                                    ),
                                  }))
                                }
                                disabled={isSaving}
                              />
                            </label>

                            <label className={styles.field}>
                              <span>Notes/Problems</span>
                              <textarea
                                className={styles.compactTextarea}
                                placeholder={
                                  serviceCopy.repairedExtraNotePlaceholder
                                }
                                value={draft.note}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    note: event.target.value.slice(0, 1600),
                                  }))
                                }
                                disabled={isSaving}
                              />
                            </label>

                            <button
                              type="button"
                              className={styles.maintenancePhotoButton}
                              onClick={openServicePhotoStep}
                              disabled={isSaving || isUploading}
                            >
                              <span className={styles.maintenancePhotoIcon}>
                                <CameraIcon
                                  className={styles.maintenancePhotoIconSvg}
                                />
                              </span>
                              <span className={styles.maintenancePhotoText}>
                                <strong>
                                  {draft.photoUrls.length
                                    ? "Photos"
                                    : "Add photos"}
                                </strong>
                                <small>
                                  {draft.photoUrls.length
                                    ? `${draft.photoUrls.length} photo${draft.photoUrls.length === 1 ? "" : "s"} ready for this record.`
                                    : "Optional."}
                                </small>
                              </span>
                            </button>
                          </>
                        ) : (
                          <div className={styles.serviceDetailsCard}>
                            <div className={styles.serviceSectionHeader}>
                              <strong>{serviceCopy.detailsHeader}</strong>
                              <small>{serviceCopy.detailsSubheader}</small>
                            </div>

                            {draft.repairDetails.trim() ? (
                              <p className={styles.selectedSummary}>
                                Repair: {draft.repairDetails.trim()}
                              </p>
                            ) : null}

                            <label className={styles.field}>
                              <span>{serviceCopy.companyLabel}</span>
                              <input
                                placeholder={serviceCopy.companyPlaceholder}
                                value={draft.serviceCompany}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    serviceCompany: event.target.value.slice(
                                      0,
                                      120,
                                    ),
                                  }))
                                }
                                disabled={isSaving}
                              />
                            </label>
                            <label className={styles.field}>
                              <span>{serviceCopy.mechanicLabel}</span>
                              <input
                                placeholder={serviceCopy.mechanicPlaceholder}
                                value={draft.mechanicName}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    mechanicName: event.target.value.slice(
                                      0,
                                      120,
                                    ),
                                  }))
                                }
                                disabled={isSaving}
                              />
                            </label>

                            <button
                              type="button"
                              className={styles.maintenancePhotoButton}
                              onClick={openServicePhotoStep}
                              disabled={isSaving || isUploading}
                            >
                              <span className={styles.maintenancePhotoIcon}>
                                <CameraIcon
                                  className={styles.maintenancePhotoIconSvg}
                                />
                              </span>
                              <span className={styles.maintenancePhotoText}>
                                <strong>
                                  {draft.photoUrls.length
                                    ? "Photos"
                                    : "Add photos"}
                                </strong>
                                <small>
                                  {draft.photoUrls.length
                                    ? `${draft.photoUrls.length} photo${draft.photoUrls.length === 1 ? "" : "s"} ready for this record.`
                                    : "Optional."}
                                </small>
                              </span>
                            </button>

                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() => setShowServiceDetailsStep(false)}
                              disabled={isSaving}
                            >
                              Back to repair details
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              ) : null}

              {activeEditor === "notes" ? (
                <div className={styles.modalStack}>
                  <label className={styles.field}>
                    <span>Notes</span>
                    <textarea
                      value={draft.note}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          note: event.target.value.slice(0, 1600),
                        }))
                      }
                      placeholder="Example: hydraulic leak noticed, tyre damaged, warning light showing, or follow-up needed."
                      disabled={isSaving}
                    />
                  </label>
                </div>
              ) : null}

              {activeEditor === "photos" ? (
                <div className={styles.modalStack}>
                  <div className={styles.mediaChoiceGrid}>
                    <button
                      type="button"
                      className={styles.mediaButton}
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={
                        isUploading ||
                        isSaving ||
                        draft.photoUrls.length >= MAX_QR_PHOTOS
                      }
                    >
                      <span className={styles.mediaButtonIcon}>
                        <UploadIcon className={styles.mediaButtonSvg} />
                      </span>
                      <span>
                        <strong>Upload</strong>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.mediaButton}
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={
                        isUploading ||
                        isSaving ||
                        draft.photoUrls.length >= MAX_QR_PHOTOS
                      }
                    >
                      <span className={styles.mediaButtonIcon}>
                        <CameraIcon className={styles.mediaButtonSvg} />
                      </span>
                      <span>
                        <strong>Take photo</strong>
                      </span>
                    </button>
                  </div>

                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className={styles.hiddenFileInput}
                    onChange={handleUploadChange}
                    disabled={isUploading || isSaving}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className={styles.hiddenFileInput}
                    onChange={handleUploadChange}
                    disabled={isUploading || isSaving}
                  />

                  <p className={styles.helperText}>
                    {isUploading
                      ? "Uploading…"
                      : `${draft.photoUrls.length} / ${MAX_QR_PHOTOS} photos`}
                  </p>

                  {draft.photoUrls.length ? (
                    <div className={styles.photoGrid}>
                      {draft.photoUrls.map((url, index) => (
                        <article
                          key={`${url}-${index}`}
                          className={styles.photoCard}
                        >
                          <img
                            src={url}
                            alt={`QR update photo ${index + 1}`}
                            className={styles.photoImage}
                          />
                          <button
                            type="button"
                            className={styles.removePhotoButton}
                            onClick={() => handleRemovePhoto(url)}
                            disabled={isSaving}
                          >
                            Remove
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.servicePhotoEmptyState}>
                      <CameraIcon className={styles.servicePhotoEmptyIcon} />
                      <strong>No photos yet.</strong>
                      <span>Add photos above.</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className={styles.editorFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={
                  activeEditor === "usage" && usageUpdateRequired
                    ? skipRequiredUsageUpdate
                    : closeEditor
                }
                disabled={isSaving}
              >
                {activeEditor === "usage" && usageUpdateRequired
                  ? "Skip for now"
                  : "Cancel"}
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={!canPressSave}
                onClick={() => {
                  if (isServicePhotoStep) {
                    closeServicePhotoStep();
                    return;
                  }

                  void handleSaveUpdate();
                }}
              >
                {saveButtonLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
