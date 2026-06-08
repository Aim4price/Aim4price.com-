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

type NoticeTone = "success" | "error";
type EditorKey = "usage" | "fuel" | "service" | "photos";
type LocationState = "idle" | "capturing" | "ready" | "error";
type ScanAssetUsageMode = "hours" | "percent" | "km" | "none";
type ScanAssetStatusChoice = "yes" | "no" | "unknown" | "not_applicable";
type ServiceMode = "" | "checked" | "serviced" | "repaired";
type PartnerType = "dealer" | "finance" | "insurance";
type ShareLeadStep = "message" | "consent" | null;

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
  fuelPercent: number | null;
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
  pinRequired?: boolean;
  preview?: boolean;
  error?: string;
};

type ScanAuthResponse = {
  ok: boolean;
  error?: string;
};

type ScanUploadResponse = {
  ok: boolean;
  uploads?: Array<{
    uploadId: string;
    url: string;
    fileName: string;
    contentType: string;
    byteSize: number;
  }>;
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
  lifeWorkedPercent: string;
  fuelPercent: string;
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
  lifeWorkedPercent: string;
  fuelPercent: string;
  notes: string[];
  photoUrls: string[];
  latitude: string;
  longitude: string;
  hasUsage: boolean;
  hasFuel: boolean;
  hasService: boolean;
  hasPhotos: boolean;
};

const MAX_QR_PHOTOS = 12;
const QUICK_FUEL_OPTIONS = [25, 50, 75, 100] as const;
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
  { label: "Tyres", description: "Pressure, tread and visible damage checked." },
  { label: "Safety", description: "Guards, warning lights and obvious risks checked." },
  { label: "Lights", description: "Working lights and indicators checked." },
  { label: "Brakes", description: "Brake response and pedal feel checked." },
  { label: "Hydraulics", description: "Hoses, rams and leaks checked." },
  { label: "Battery", description: "Terminals, charge and mounting checked." },
  { label: "Coolant", description: "Level and visible leaks checked." },
  { label: "Belts", description: "Wear, cracks and tension checked." },
  { label: "Leaks", description: "Oil, diesel, coolant and hydraulic leaks checked." },
] as const;

const PROPELLED_SERVICED_OPTIONS: readonly ServiceOption[] = [
  { label: "Changed engine oil", description: "Engine oil drained and replaced." },
  { label: "Changed hydraulic oil", description: "Hydraulic oil serviced or replaced." },
  { label: "Changed air filters", description: "Air filter elements cleaned or replaced." },
  { label: "Changed oil filters", description: "Engine oil filters replaced." },
  { label: "Changed diesel filters", description: "Fuel / diesel filters replaced." },
  { label: "Greased machine", description: "Grease points completed." },
  { label: "Coolant top-up", description: "Coolant topped up or replaced." },
  { label: "Replaced belts", description: "Worn belts replaced or adjusted." },
  { label: "Tyre repair", description: "Tyre puncture, valve or pressure repair." },
  { label: "Battery service", description: "Battery serviced, replaced or terminals cleaned." },
] as const;

const IMPLEMENT_CHECKED_OPTIONS: readonly ServiceOption[] = [
  { label: "Nuts and bolts", description: "Loose, missing or damaged bolts checked." },
  { label: "Pins and bushes", description: "Wear, play and locking clips checked." },
  { label: "Frame and welds", description: "Cracks, bent sections and welds checked." },
  { label: "Hitch / drawbar", description: "Hitch points, hooks and drawbar checked." },
  { label: "Hydraulic hoses", description: "Hoses, couplers, rams and leaks checked." },
  { label: "Bearings", description: "Noise, heat, play and visible wear checked." },
  { label: "Wear parts", description: "Blades, points, discs, tines or shoes checked." },
  { label: "PTO / guards", description: "PTO shaft, covers and safety guards checked." },
  { label: "Wheels / hubs", description: "Wheel nuts, hubs, bearings and tyres checked." },
  { label: "Grease points", description: "Grease nipples and moving joints checked." },
  { label: "Safety decals", description: "Warnings, reflectors and visible markings checked." },
] as const;

const IMPLEMENT_SERVICED_OPTIONS: readonly ServiceOption[] = [
  { label: "Tightened bolts", description: "Loose fasteners tightened or replaced." },
  { label: "Replaced pins / bushes", description: "Worn pins, bushes or clips replaced." },
  { label: "Repaired frame / welds", description: "Cracks, bends or welds repaired." },
  { label: "Replaced wear parts", description: "Blades, points, discs, tines or shoes replaced." },
  { label: "Serviced hydraulics", description: "Hydraulic hoses, couplers or cylinders repaired." },
  { label: "Replaced bearings", description: "Bearings, seals or hubs replaced." },
  { label: "Greased implement", description: "Grease points and moving joints serviced." },
  { label: "Serviced PTO / guards", description: "PTO shaft, covers or guards repaired." },
  { label: "Adjusted setup", description: "Depth, angle, calibration or working setup adjusted." },
  { label: "Wheel / hub service", description: "Wheel nuts, tyres, hubs or axles serviced." },
  { label: "Cleaned implement", description: "Mud, crop material or residue removed." },
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
  lifeWorkedPercent: "",
  fuelPercent: "",
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
  lifeWorkedPercent: "",
  fuelPercent: "",
  notes: [],
  photoUrls: [],
  latitude: "",
  longitude: "",
  hasUsage: false,
  hasFuel: false,
  hasService: false,
  hasPhotos: false,
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
  if (typeof window === "undefined" || typeof document === "undefined") return file;
  if (!file.type.toLowerCase().startsWith("image/")) return file;
  if (file.size <= QR_PHOTO_SKIP_COMPRESSION_BYTES && file.type.toLowerCase() === "image/jpeg") return file;

  try {
    const image = await loadImageElement(file);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) return file;

    const scale = Math.min(1, QR_PHOTO_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
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

function formatFuel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function normalizeFuelPercentText(value: string, fallback: number | null = null): string {
  const source = value.trim() || (fallback !== null && Number.isFinite(fallback) ? String(fallback) : "0");
  const parsed = Number(source);

  if (!Number.isFinite(parsed)) return "0";
  return String(Math.max(0, Math.min(100, Math.round(parsed))));
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
  if (asset.usageMode === "percent") return "Current worked percentage";
  if (asset.usageMode === "km") return "Current kilometre reading";
  return "Current hour-meter reading";
}

function usagePlaceholder(asset: ScanSafeAsset): string {
  if (asset.usageMode === "percent") {
    return asset.lifeWorkedPercent !== null
      ? String(asset.lifeWorkedPercent)
      : "Enter % worked";
  }

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
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assetClassifierText(asset: ScanSafeAsset): string {
  return normalizeClassifierText([
    asset.kind,
    asset.equipmentFamilyKey,
    asset.equipmentFamilyLabel,
    asset.title,
  ].join(" "));
}

function containsAnyHint(text: string, hints: readonly string[]): boolean {
  return hints.some((hint) => text.includes(hint));
}

function resolveAssetServiceProfile(asset: ScanSafeAsset | null): AssetServiceProfile {
  if (!asset) return "propelled";

  if (asset.isPropelled || asset.canUpdateFuel || asset.kind === "vehicle" || asset.kind === "tractor") {
    return "propelled";
  }

  const classifierText = assetClassifierText(asset);

  if (containsAnyHint(classifierText, IMPLEMENT_HINTS)) {
    return "implement";
  }

  if (asset.usageMode === "percent") {
    return "implement";
  }

  if (containsAnyHint(classifierText, PROPELLED_HINTS) || asset.usageMode === "km" || asset.usageMode === "hours") {
    return "propelled";
  }

  return "implement";
}

function checkedOptionsForProfile(profile: AssetServiceProfile): readonly ServiceOption[] {
  return profile === "implement" ? IMPLEMENT_CHECKED_OPTIONS : PROPELLED_CHECKED_OPTIONS;
}

function servicedOptionsForProfile(profile: AssetServiceProfile): readonly ServiceOption[] {
  return profile === "implement" ? IMPLEMENT_SERVICED_OPTIONS : PROPELLED_SERVICED_OPTIONS;
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
      checkedNotePlaceholder: "Example: bolts checked, pins checked, no visible cracks.",
      servicedNotePlaceholder: "Example: replaced points, tightened bolts and greased pins.",
      repairedNotePlaceholder: "Example: cracked bracket repaired; two bushes replaced; welds checked.",
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
    checkedNotePlaceholder: "Example: oil checked, tyres checked, no visible leaks.",
    servicedNotePlaceholder: "Example: full service completed; oil and filters replaced.",
    repairedNotePlaceholder: "Example: hydraulic leak repaired; hose replaced; pressure tested.",
    repairedExtraNotePlaceholder: "Optional: parts used or follow-up needed.",
  };
}

function buildEditorSummary(editor: EditorKey, asset: ScanSafeAsset | null): string {
  if (editor === "usage") return formatUsage(asset);

  if (editor === "fuel") {
    return asset?.fuelPercent !== null && typeof asset?.fuelPercent !== "undefined"
      ? `${formatFuel(asset.fuelPercent)} fuel level`
      : "Capture fuel level";
  }

  if (editor === "service") return "Check · service · repair";

  if (asset?.photos.length) {
    return `${asset.photos.length} photo${asset.photos.length === 1 ? "" : "s"} stored`;
  }

  return "Upload or take photos";
}

function needsUsageUpdateBeforeActions(
  asset: ScanSafeAsset | null,
  update: PendingScanUpdate,
  hasCompletedRequiredUsageUpdate: boolean,
): boolean {
  return Boolean(
    asset &&
      asset.usageMode !== "none" &&
      !update.hasUsage &&
      !hasCompletedRequiredUsageUpdate,
  );
}

function requiredUsageTitle(asset: ScanSafeAsset): string {
  if (asset.usageMode === "km") return "Update kilometres first";
  if (asset.usageMode === "percent") return "Update worked percentage first";
  return "Update hours first";
}

function requiredUsageCopy(asset: ScanSafeAsset): string {
  if (asset.usageMode === "km") {
    return "Enter the latest kilometre reading before fuel, maintenance or photos can be added.";
  }

  if (asset.usageMode === "percent") {
    return "Enter the latest worked percentage before fuel, maintenance or photos can be added.";
  }

  return "Enter the latest hour-meter reading before fuel, maintenance or photos can be added.";
}

function requiredUsageButtonLabel(asset: ScanSafeAsset): string {
  if (asset.usageMode === "km") return "Update kilometres";
  if (asset.usageMode === "percent") return "Update percentage";
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
  return update.hasUsage || update.hasFuel || update.hasService || update.hasPhotos;
}

function keepCurrentLocation(current: DraftState): DraftState {
  return {
    ...initialDraft,
    latitude: current.latitude,
    longitude: current.longitude,
  };
}

function buildServiceNote(draft: DraftState): string {
  const note = draft.note.trim();

  if (draft.serviceMode === "checked") {
    return [
      "Checked",
      draft.checkedItems.length ? `Checked items: ${draft.checkedItems.join(", ")}` : "",
      note ? `Notes: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (draft.serviceMode === "serviced") {
    return [
      "Serviced",
      draft.servicedItems.length ? `Work done: ${draft.servicedItems.join(", ")}` : "",
      draft.serviceCompany.trim() ? `Company: ${draft.serviceCompany.trim()}` : "",
      draft.mechanicName.trim() ? `Mechanic: ${draft.mechanicName.trim()}` : "",
      note ? `Notes: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (draft.serviceMode === "repaired") {
    return [
      "Repaired",
      draft.repairDetails.trim() ? `Repair details: ${draft.repairDetails.trim()}` : "",
      draft.serviceCompany.trim() ? `Company: ${draft.serviceCompany.trim()}` : "",
      draft.mechanicName.trim() ? `Mechanic: ${draft.mechanicName.trim()}` : "",
      note ? `Notes: ${note}` : "",
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

    const existingScript = document.getElementById(SCAN_LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;

    const resolveWhenReady = () => {
      if (window.L) {
        resolve(window.L);
      } else {
        reject(new Error("Map could not be loaded."));
      }
    };

    if (existingScript) {
      existingScript.addEventListener("load", resolveWhenReady, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Map could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCAN_LEAFLET_SCRIPT_ID;
    script.src = SCAN_LEAFLET_JS_URL;
    script.async = true;
    script.addEventListener("load", resolveWhenReady, { once: true });
    script.addEventListener("error", () => reject(new Error("Map could not be loaded.")), { once: true });
    document.body.appendChild(script);
  });

  return scanLeafletLoaderPromise;
}

function dealerPartnerName(partner: PartnerDirectoryEntry): string {
  return partner.businessName || partner.displayName || "Aim4price dealer";
}

function dealerPartnerLocation(partner: PartnerDirectoryEntry): string {
  return [partner.townCity, partner.province].filter(Boolean).join(", ") || "Location not saved";
}

function dealerPartnerInitial(partner: PartnerDirectoryEntry): string {
  const name = dealerPartnerName(partner);
  return name.trim().charAt(0).toUpperCase() || "D";
}

function dealerPartnerAddress(partner: PartnerDirectoryEntry): string {
  return [partner.addressLine1, partner.townCity, partner.province].filter(Boolean).join(", ");
}

function dealerPartnerServicesDisplay(partner: PartnerDirectoryEntry): string {
  return partner.services || partner.brandFocus || "Dealer services";
}

function hasDealerPartnerCoordinates(partner: PartnerDirectoryEntry): boolean {
  return typeof partner.latitude === "number"
    && Number.isFinite(partner.latitude)
    && typeof partner.longitude === "number"
    && Number.isFinite(partner.longitude);
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

function apiErrorMessage(payload: { error?: string } | null | undefined, fallback: string): string {
  return payload?.error || fallback;
}

type IconProps = { className?: string };

function MeterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M7 17h10" />
      <path d="M12 17l4.2-5.2" />
      <path d="M7.7 10.4l.8.8" />
      <path d="M16.3 10.4l-.8.8" />
      <path d="M12 8.2v1.2" />
    </svg>
  );
}

function FuelIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6.5 21V5.5A2.5 2.5 0 0 1 9 3h5a2.5 2.5 0 0 1 2.5 2.5V21" />
      <path d="M7 21h10" />
      <path d="M9 7h5" />
      <path d="M16.5 8h1.4l2.1 2.5V17a2 2 0 0 1-2 2h-1.5" />
      <path d="M20 10.5h-2.2a1.3 1.3 0 0 1-1.3-1.3V8" />
    </svg>
  );
}

function ServiceIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.4 12.3 2.3 2.3 5-5.2" />
    </svg>
  );
}

function WrenchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14.7 6.2a4.5 4.5 0 0 0-5.4 5.6L4.4 16.7a1.6 1.6 0 0 0 0 2.2l.7.7a1.6 1.6 0 0 0 2.2 0l4.9-4.9a4.5 4.5 0 0 0 5.6-5.4l-3 3-3.1-3.1z" />
      <path d="M5.8 18.2h.01" />
    </svg>
  );
}

function RepairIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M13.4 2.8 4.8 13.3c-.5.6-.1 1.5.7 1.5h5.1l-1.2 6.1c-.2 1 .9 1.6 1.6.8l8.6-10.8c.5-.6 0-1.5-.7-1.5h-5.1l1.2-5.8c.2-1-.9-1.6-1.6-.8z" />
    </svg>
  );
}

function UploadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 15.5V4.5" />
      <path d="m7.2 9.2 4.8-4.8 4.8 4.8" />
      <path d="M5 19.5h14" />
      <path d="M7 16.5h10" />
    </svg>
  );
}

function CameraIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 8a2 2 0 0 1 2-2h2.6l1.4-2h4l1.4 2H18a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="4" />
      <path d="M17 9h.01" />
    </svg>
  );
}

function ShareIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 21s-6.5-4.4-6.5-10.2a6.5 6.5 0 1 1 13 0C18.5 16.6 12 21 12 21z" />
      <circle cx="12" cy="10.8" r="2.4" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export default function ScanClient({
  publicAssetCode,
}: {
  publicAssetCode: string;
}) {
  const normalizedCode = useMemo(
    () => normalizePublicAssetCode(publicAssetCode),
    [publicAssetCode],
  );

  const [asset, setAsset] = useState<ScanSafeAsset | null>(null);
  const [savedAsset, setSavedAsset] = useState<ScanSafeAsset | null>(null);
  const [assetPreview, setAssetPreview] = useState<ScanSafeAsset | null>(null);
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [pendingUpdate, setPendingUpdate] = useState<PendingScanUpdate>(initialPendingUpdate);
  const [pin, setPin] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [isLoadingAsset, setIsLoadingAsset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [locationMessage, setLocationMessage] = useState(
    "Location must be enabled before this asset QR can continue.",
  );
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [activeEditor, setActiveEditor] = useState<EditorKey | null>(null);
  const [showLocationReminder, setShowLocationReminder] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [hasCompletedRequiredUsageUpdate, setHasCompletedRequiredUsageUpdate] = useState(false);
  const [showServiceDetailsStep, setShowServiceDetailsStep] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharePartners, setSharePartners] = useState<PartnerDirectoryEntry[]>([]);
  const [sharePartnerSearch, setSharePartnerSearch] = useState("");
  const [selectedSharePartnerId, setSelectedSharePartnerId] = useState("");
  const [shareOwnerMessage, setShareOwnerMessage] = useState("");
  const [shareLeadStep, setShareLeadStep] = useState<ShareLeadStep>(null);
  const [shareConsentAccepted, setShareConsentAccepted] = useState(false);
  const [isLoadingSharePartners, setIsLoadingSharePartners] = useState(false);
  const [isSendingShareLead, setIsSendingShareLead] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const autoLocationKeyRef = useRef<string>("");
  const shareMapElementRef = useRef<HTMLDivElement | null>(null);
  const shareLeafletMapRef = useRef<any>(null);
  const shareMarkerLayerRef = useRef<any>(null);
  const shareMarkersByPartnerRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    const previousBodyBackground = document.body.style.background;
    const footerElements = Array.from(document.querySelectorAll<HTMLElement>("footer"));
    const previousFooterDisplays = footerElements.map((element) => ({
      element,
      display: element.style.display,
    }));

    document.body.style.background = "#f3f7f8";
    footerElements.forEach((element) => {
      element.style.display = "none";
    });

    try {
      const savedName = window.localStorage.getItem("aim4price_scan_operator_name");
      if (savedName) setOperatorName(savedName);
    } catch {
      // Local storage is optional for this screen.
    }

    return () => {
      document.body.style.background = previousBodyBackground;
      previousFooterDisplays.forEach(({ element, display }) => {
        element.style.display = display;
      });
    };
  }, []);

  useEffect(() => {
    setAsset(null);
    setSavedAsset(null);
    setAssetPreview(null);
    setDraft(initialDraft);
    setPendingUpdate(initialPendingUpdate);
    setPin("");
    setIsUnavailable(false);
    setIsSubmittingPin(false);
    setIsLoadingAsset(false);
    setIsSaving(false);
    setIsUploading(false);
    setActiveEditor(null);
    setShowLocationReminder(false);
    setIsDone(false);
    setHasCompletedRequiredUsageUpdate(false);
    setShowServiceDetailsStep(false);
    setIsShareModalOpen(false);
    setSharePartners([]);
    setSharePartnerSearch("");
    setSelectedSharePartnerId("");
    setShareOwnerMessage("");
    setShareLeadStep(null);
    setShareConsentAccepted(false);
    setIsLoadingSharePartners(false);
    setIsSendingShareLead(false);
    setLocationState("idle");
    setLocationMessage(
      "Location must be enabled before this asset QR can continue.",
    );
    if (shareLeafletMapRef.current) {
      shareLeafletMapRef.current.remove();
      shareLeafletMapRef.current = null;
      shareMarkerLayerRef.current = null;
      shareMarkersByPartnerRef.current.clear();
    }
    autoLocationKeyRef.current = "";
  }, [normalizedCode]);

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
        const data = (await response.json().catch(() => null)) as ScanAssetResponse | null;

        if (!isMounted) return;

        if (response.ok && data?.ok && data.asset) {
          setAssetPreview(data.asset);
          return;
        }

        if (response.status === 403 || response.status === 404) {
          setIsUnavailable(true);
        }
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
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

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
    if (!isShareModalOpen || shareLeadStep || !shareMapElementRef.current) return undefined;

    const partnersWithCoordinates = sharePartners.filter(hasDealerPartnerCoordinates);
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

          shareMarkerLayerRef.current = leaflet.layerGroup().addTo(shareLeafletMapRef.current);
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
              const button = popupElement?.querySelector?.("button[data-scan-share-partner-id]") as HTMLButtonElement | null;
              button?.addEventListener("click", () => openShareLeadMessage(partner), { once: true });
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
    const selectedPartner = sharePartners.find((partner) => partner.userId === selectedSharePartnerId);
    if (!selectedPartner || !hasDealerPartnerCoordinates(selectedPartner)) return;

    const map = shareLeafletMapRef.current;
    const marker = shareMarkersByPartnerRef.current.get(selectedPartner.userId);

    if (!map || !marker) return;

    map.setView([selectedPartner.latitude, selectedPartner.longitude], Math.max(map.getZoom?.() ?? DEFAULT_DEALER_MAP_ZOOM, 8), { animate: true });
    marker.openPopup();
  }, [isShareModalOpen, shareLeadStep, selectedSharePartnerId, sharePartners]);

  useEffect(() => {
    if (!asset?.id) return;
    if (autoLocationKeyRef.current === asset.id) return;
    autoLocationKeyRef.current = asset.id;

    if (hasLocationCaptured(draft)) {
      setLocationState("ready");
      return;
    }

    void captureLocation(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id]);

  async function loadUnlockedAsset() {
    setIsLoadingAsset(true);
    setIsUnavailable(false);

    try {
      const response = await fetch(
        `/api/scan/assets/${encodeURIComponent(normalizedCode)}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const data = (await response.json().catch(() => null)) as ScanAssetResponse | null;

      if (response.status === 401) {
        throw new Error(data?.error ?? "Enter the farm scan PIN again.");
      }

      if (response.status === 403 || response.status === 404) {
        setAsset(null);
        setIsUnavailable(true);
        throw new Error(
          data?.error ??
            (response.status === 404
              ? "Asset not found."
              : "Scan access is not enabled yet."),
        );
      }

      if (!response.ok || !data?.ok || !data.asset) {
        throw new Error(data?.error ?? "Failed to open this asset.");
      }

      const openedAsset = data.asset;
      const requiresInitialUsageUpdate = openedAsset.usageMode !== "none";

      setAsset(openedAsset);
      setSavedAsset(openedAsset);
      setAssetPreview(openedAsset);
      setDraft((current) => {
        const nextDraft = {
          ...initialDraft,
          latitude: current.latitude,
          longitude: current.longitude,
        };

        if (openedAsset.usageMode === "percent") {
          return {
            ...nextDraft,
            lifeWorkedPercent: openedAsset.lifeWorkedPercent !== null
              ? String(openedAsset.lifeWorkedPercent)
              : "",
          };
        }

        if (openedAsset.usageMode === "hours" || openedAsset.usageMode === "km") {
          return {
            ...nextDraft,
            hours: openedAsset.hours !== null
              ? String(Math.round(openedAsset.hours))
              : "",
          };
        }

        return nextDraft;
      });
      setPendingUpdate(initialPendingUpdate);
      setIsDone(false);
      setHasCompletedRequiredUsageUpdate(!requiresInitialUsageUpdate);
      setShowLocationReminder(false);
      setActiveEditor(requiresInitialUsageUpdate ? "usage" : null);
      setLocationState("ready");
    } finally {
      setIsLoadingAsset(false);
    }
  }

  async function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanOperatorName = operatorName.trim();

    if (pin.length < 4) {
      setNotice({ tone: "error", message: "Enter the farm scan PIN." });
      return;
    }

    if (cleanOperatorName.length < 2) {
      setNotice({ tone: "error", message: "Enter your name before opening the asset." });
      return;
    }

    if (!hasLocationCaptured(draft)) {
      setNotice({ tone: "error", message: "Capture GPS first. Location must be enabled before this asset QR can continue." });
      void captureLocation(false);
      return;
    }

    setIsSubmittingPin(true);
    setIsUnavailable(false);

    try {
      const response = await fetch("/api/scan/auth", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicAssetCode: normalizedCode, pin }),
      });
      const data = (await response.json().catch(() => null)) as ScanAuthResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Incorrect scan PIN.");
      }

      try {
        window.localStorage.setItem("aim4price_scan_operator_name", cleanOperatorName);
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

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []) as File[];
    if (!selectedFiles.length) return;

    const remainingSlots = MAX_QR_PHOTOS - draft.photoUrls.length;
    if (remainingSlots <= 0) {
      setNotice({ tone: "error", message: `You can add up to ${MAX_QR_PHOTOS} photos per update.` });
      event.target.value = "";
      return;
    }

    const files = selectedFiles.slice(0, remainingSlots);
    setIsUploading(true);

    try {
      const compressedFiles = await Promise.all(files.map((file) => compressQrPhoto(file)));
      const formData = new FormData();
      formData.set("publicAssetCode", normalizedCode);
      compressedFiles.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/scan/uploads", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as ScanUploadResponse | null;

      if (!response.ok || !data?.ok || !data.uploads?.length) {
        throw new Error(data?.error ?? "Failed to upload photos.");
      }

      setDraft((current) => ({
        ...current,
        photoUrls: Array.from(
          new Set([
            ...current.photoUrls,
            ...data.uploads!.map((entry) => entry.url),
          ]),
        ).slice(0, MAX_QR_PHOTOS),
      }));

      setNotice({
        tone: "success",
        message: `${data.uploads.length} photo${data.uploads.length === 1 ? "" : "s"} added.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to upload photos.",
      });
    } finally {
      event.target.value = "";
      setIsUploading(false);
    }
  }

  function handleRemovePhoto(url: string) {
    setDraft((current) => ({
      ...current,
      photoUrls: current.photoUrls.filter((entry) => entry !== url),
    }));
  }

  function openEditor(nextEditor: EditorKey) {
    const enforcedEditor = nextEditor !== "usage" && needsUsageUpdateBeforeActions(asset, pendingUpdate, hasCompletedRequiredUsageUpdate)
      ? "usage"
      : nextEditor;

    if (enforcedEditor !== nextEditor && asset) {
      setNotice({ tone: "error", message: requiredUsageCopy(asset) });
    }

    setDraft((current) => {
      const nextDraft = keepCurrentLocation(current);

      if (!asset) return nextDraft;

      if (enforcedEditor === "usage") {
        if (asset.usageMode === "percent") {
          const stagedPercent = pendingUpdate.hasUsage && pendingUpdate.lifeWorkedPercent
            ? pendingUpdate.lifeWorkedPercent
            : asset.lifeWorkedPercent !== null
              ? String(asset.lifeWorkedPercent)
              : "";

          return { ...nextDraft, lifeWorkedPercent: stagedPercent };
        }

        if (asset.usageMode === "hours" || asset.usageMode === "km") {
          const stagedHours = pendingUpdate.hasUsage && pendingUpdate.hours
            ? pendingUpdate.hours
            : asset.hours !== null
              ? String(Math.round(asset.hours))
              : "";

          return { ...nextDraft, hours: stagedHours };
        }
      }

      if (enforcedEditor === "fuel") {
        const stagedFuel = pendingUpdate.hasFuel && pendingUpdate.fuelPercent
          ? pendingUpdate.fuelPercent
          : String(Math.round(asset.fuelPercent ?? 100));

        return { ...nextDraft, fuelPercent: stagedFuel };
      }

      if (enforcedEditor === "photos") {
        return { ...nextDraft, photoUrls: pendingUpdate.photoUrls };
      }

      return nextDraft;
    });

    setShowServiceDetailsStep(false);
    setActiveEditor(enforcedEditor);
  }

  function closeEditor() {
    setDraft((current) => keepCurrentLocation(current));
    setShowServiceDetailsStep(false);
    setActiveEditor(null);
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
    setShareLeadStep(null);
    setShareConsentAccepted(false);
  }

  function closeShareModal() {
    if (isSaving || isSendingShareLead) return;
    setIsShareModalOpen(false);
    setSharePartners([]);
    resetShareFlow();
    removeShareMap();
  }

  async function loadSharePartners(searchValue = sharePartnerSearch) {
    setIsLoadingSharePartners(true);

    try {
      const query = searchValue.trim() ? `?search=${encodeURIComponent(searchValue.trim())}` : "";
      const response = await fetch(
        `/api/scan/assets/${encodeURIComponent(normalizedCode)}/dealer-share${query}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      const data = (await response.json().catch(() => null)) as PartnerDirectoryApiResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(apiErrorMessage(data, "Failed to load local dealers."));
      }

      const nextPartners = data.partners ?? [];
      setSharePartners(nextPartners);
      setSelectedSharePartnerId((current) => {
        if (!current) return current;
        return nextPartners.some((partner) => partner.userId === current) ? current : "";
      });
    } catch (error) {
      setSharePartners([]);
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load local dealers.",
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

    if (needsUsageUpdateBeforeActions(asset, pendingUpdate, hasCompletedRequiredUsageUpdate)) {
      setNotice({ tone: "error", message: requiredUsageCopy(asset) });
      openEditor("usage");
      return;
    }

    if (!hasLocationCaptured(draft)) {
      setNotice({ tone: "error", message: "GPS is required before sending this asset to a dealer." });
      void captureLocation(false);
      return;
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
    if (isSendingShareLead) return;
    setShareLeadStep(null);
    setShareConsentAccepted(false);
  }

  function goToShareConsent() {
    if (!selectedSharePartnerId) {
      setNotice({ tone: "error", message: "Choose a dealer before sending." });
      return;
    }

    setShareConsentAccepted(false);
    setShareLeadStep("consent");
  }

  async function handleSendDealerShareLead() {
    if (!asset) return;

    const selectedPartner = sharePartners.find((partner) => partner.userId === selectedSharePartnerId);

    if (!selectedPartner) {
      setNotice({ tone: "error", message: "Choose a dealer before sending." });
      return;
    }

    if (!shareConsentAccepted) {
      setNotice({ tone: "error", message: "Confirm that the asset may be sent to the dealer." });
      return;
    }

    if (operatorName.trim().length < 2) {
      setNotice({ tone: "error", message: "Enter your name before sending to a dealer." });
      return;
    }

    const shareLatitude = pendingUpdate.latitude || draft.latitude;
    const shareLongitude = pendingUpdate.longitude || draft.longitude;

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
          }),
        },
      );
      const data = (await response.json().catch(() => null)) as DealerShareLeadResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(apiErrorMessage(data, "Failed to send the asset to the dealer."));
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
        message: error instanceof Error ? error.message : "Failed to send the asset to the dealer.",
      });
    } finally {
      setIsSendingShareLead(false);
    }
  }

  function handleFuelTap() {
    if (!asset?.canUpdateFuel) {
      setNotice({ tone: "error", message: "Fuel updates are not enabled for this asset yet." });
      return;
    }

    openEditor("fuel");
  }

  async function captureLocation(isAutomatic = false) {
    if (typeof window === "undefined" || !window.isSecureContext) {
      setLocationState("error");
      setLocationMessage("Location can only be captured on a secure HTTPS page.");
      return;
    }

    if (!navigator.geolocation) {
      setLocationState("error");
      setLocationMessage("Location is not supported on this device.");
      return;
    }

    setLocationState("capturing");
    setLocationMessage(
      isAutomatic
        ? "Refreshing GPS location…"
        : "Getting GPS location...",
    );

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = String(position.coords.latitude);
          const longitude = String(position.coords.longitude);
          const locationText = `GPS captured: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
          setDraft((current) => ({ ...current, latitude, longitude }));
          setLocationState("ready");
          setLocationMessage(locationText);
          if (!isAutomatic && asset) setNotice({ tone: "success", message: "Location captured." });
          resolve();
        },
        () => {
          setLocationState("error");
          setLocationMessage("GPS permission is required. Enable location access and capture GPS again.");
          if (!isAutomatic && asset) {
            setNotice({
              tone: "error",
              message: "GPS permission is required. Enable location access and capture GPS again.",
            });
          }
          resolve();
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
      );
    });
  }

  function validateDraftForSave(): { ok: boolean; message?: string } {
    if (!asset || !activeEditor) return { ok: false, message: "Choose an update first." };

    const persistedAsset = savedAsset ?? asset;

    if (operatorName.trim().length < 2) {
      return { ok: false, message: "Enter your name before saving." };
    }

    if (!hasLocationCaptured(draft)) {
      return {
        ok: false,
        message: "Location is required for every QR update. Allow GPS and try again.",
      };
    }

    if (activeEditor === "usage") {
      if (asset.usageMode === "percent") {
        if (!draft.lifeWorkedPercent.trim()) return { ok: false, message: "Enter the current worked percentage." };
        const nextPercent = Number(draft.lifeWorkedPercent);
        if (persistedAsset.lifeWorkedPercent !== null && nextPercent < persistedAsset.lifeWorkedPercent) {
          return { ok: false, message: "The new percentage cannot be lower than the saved percentage." };
        }
        return { ok: true };
      }

      if (!draft.hours.trim()) return { ok: false, message: "Enter the current reading." };
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

    if (activeEditor === "fuel") {
      if (!draft.fuelPercent.trim()) return { ok: false, message: "Choose the fuel level." };
      return { ok: true };
    }

    if (activeEditor === "service") {
      if (!draft.serviceMode) return { ok: false, message: "Choose a type." };

      const validationServiceCopy = serviceCopyForProfile(resolveAssetServiceProfile(asset));

      if (draft.serviceMode === "checked") {
        if (!draft.checkedItems.length && !draft.note.trim()) {
          return { ok: false, message: "Select what was checked or add a note." };
        }
        return { ok: true };
      }

      if (draft.serviceMode === "serviced") {
        if (!draft.servicedItems.length && !draft.note.trim()) {
          return { ok: false, message: "Select what was serviced or add a note." };
        }
      }

      if (draft.serviceMode === "repaired") {
        if (!draft.repairDetails.trim()) {
          return { ok: false, message: "Explain exactly what was repaired." };
        }
      }

      if (!showServiceDetailsStep && (!draft.serviceCompany.trim() || !draft.mechanicName.trim())) {
        setShowServiceDetailsStep(true);
        return { ok: false };
      }

      if (!draft.serviceCompany.trim()) {
        return { ok: false, message: `Enter the ${validationServiceCopy.companyLabel.toLowerCase()}.` };
      }
      if (!draft.mechanicName.trim()) {
        return { ok: false, message: `Enter the ${validationServiceCopy.mechanicLabel.toLowerCase()}.` };
      }
      return { ok: true };
    }

    if (activeEditor === "photos") {
      if (!draft.photoUrls.length) return { ok: false, message: "Upload or take at least one photo." };
      return { ok: true };
    }

    return { ok: false, message: "Choose an update first." };
  }

  function handleSaveUpdate() {
    if (!asset || !activeEditor) return;

    const validation = validateDraftForSave();
    if (!validation.ok) {
      if (validation.message) setNotice({ tone: "error", message: validation.message });
      return;
    }

    const savedLatitude = draft.latitude;
    const savedLongitude = draft.longitude;

    if (activeEditor === "usage") {
      if (asset.usageMode === "percent") {
        const stagedPercent = draft.lifeWorkedPercent.trim();
        const parsedPercent = Number(stagedPercent);

        setPendingUpdate((current) => ({
          ...current,
          hours: "",
          lifeWorkedPercent: stagedPercent,
          latitude: savedLatitude || current.latitude,
          longitude: savedLongitude || current.longitude,
          hasUsage: true,
        }));
        setAsset((current) => current ? { ...current, lifeWorkedPercent: parsedPercent } : current);
      } else if (asset.usageMode === "hours" || asset.usageMode === "km") {
        const stagedHours = draft.hours.trim();
        const parsedHours = Number(stagedHours);

        setPendingUpdate((current) => ({
          ...current,
          hours: stagedHours,
          lifeWorkedPercent: "",
          latitude: savedLatitude || current.latitude,
          longitude: savedLongitude || current.longitude,
          hasUsage: true,
        }));
        setAsset((current) => current ? { ...current, hours: parsedHours } : current);
      }

      setHasCompletedRequiredUsageUpdate(true);
    }

    if (activeEditor === "fuel") {
      const stagedFuel = draft.fuelPercent.trim();
      const parsedFuel = Number(stagedFuel);

      setPendingUpdate((current) => ({
        ...current,
        fuelPercent: stagedFuel,
        latitude: savedLatitude || current.latitude,
        longitude: savedLongitude || current.longitude,
        hasFuel: true,
      }));
      setAsset((current) => current ? { ...current, fuelPercent: parsedFuel } : current);
    }

    if (activeEditor === "service") {
      const serviceNote = buildServiceNote(draft);

      setPendingUpdate((current) => ({
        ...current,
        notes: mergeUniqueStrings([...current.notes, serviceNote]),
        latitude: savedLatitude || current.latitude,
        longitude: savedLongitude || current.longitude,
        hasService: true,
      }));
    }

    if (activeEditor === "photos") {
      const stagedPhotos = mergeUniqueStrings(draft.photoUrls, MAX_QR_PHOTOS);

      setPendingUpdate((current) => ({
        ...current,
        photoUrls: mergeUniqueStrings([...current.photoUrls, ...stagedPhotos], MAX_QR_PHOTOS),
        latitude: savedLatitude || current.latitude,
        longitude: savedLongitude || current.longitude,
        hasPhotos: stagedPhotos.length > 0 || current.hasPhotos,
      }));
      setAsset((current) => current
        ? { ...current, photos: mergeUniqueStrings([...current.photos, ...stagedPhotos], MAX_QR_PHOTOS) }
        : current,
      );
    }

    setDraft({ ...initialDraft, latitude: savedLatitude, longitude: savedLongitude });
    setActiveEditor(null);
    setShowServiceDetailsStep(false);
    setNotice({ tone: "success", message: "Update added. Tap Done to save it to the asset register." });
    setLocationState("ready");
    setLocationMessage("GPS is ready for this update.");
    void captureLocation(true);
  }

  function closeDoneSession() {
    setActiveEditor(null);
    setShowLocationReminder(false);
    setIsDone(true);

    try {
      window.history.replaceState({ aim4priceQrDone: true }, "", window.location.href);
    } catch {
      // Ignore history replacement errors.
    }

    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);
  }

  async function persistPendingScanUpdate(): Promise<ScanSafeAsset | null> {
    if (!asset) return null;

    if (!hasPendingScanUpdate(pendingUpdate)) {
      return asset;
    }

    const finalLatitude = pendingUpdate.latitude || draft.latitude;
    const finalLongitude = pendingUpdate.longitude || draft.longitude;

    if (operatorName.trim().length < 2) {
      setNotice({ tone: "error", message: "Enter your name before saving." });
      return null;
    }

    if (!finalLatitude.trim() || !finalLongitude.trim()) {
      setNotice({ tone: "error", message: "Location is required. Allow GPS before saving." });
      void captureLocation(false);
      return null;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/scan/assets/${encodeURIComponent(normalizedCode)}/event`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatorName: operatorName.trim(),
            hours:
              pendingUpdate.hasUsage && (asset.usageMode === "hours" || asset.usageMode === "km")
                ? pendingUpdate.hours
                : "",
            lifeWorkedPercent:
              pendingUpdate.hasUsage && asset.usageMode === "percent"
                ? pendingUpdate.lifeWorkedPercent
                : "",
            fuelPercent: pendingUpdate.hasFuel && asset.canUpdateFuel ? pendingUpdate.fuelPercent : "",
            note: pendingUpdate.notes.join("\n\n---\n\n"),
            photoUrls: pendingUpdate.photoUrls,
            latitude: finalLatitude,
            longitude: finalLongitude,
          }),
        },
      );
      const data = (await response.json().catch(() => null)) as SaveScanEventResponse | null;

      if (!response.ok || !data?.ok || !data.asset) {
        throw new Error(data?.error ?? "Failed to save the QR update.");
      }

      setAsset(data.asset);
      setSavedAsset(data.asset);
      setAssetPreview(data.asset);
      if (pendingUpdate.hasUsage) {
        setHasCompletedRequiredUsageUpdate(true);
      }
      setPendingUpdate(initialPendingUpdate);
      setDraft(initialDraft);
      return data.asset;
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to save the QR update.",
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

    const saved = await persistPendingScanUpdate();

    if (saved) {
      closeDoneSession();
    }
  }

  const locationReady = hasLocationCaptured(draft);
  const showUsageAction = asset ? asset.usageMode !== "none" : false;
  const usageUpdateRequired = showUsageAction && needsUsageUpdateBeforeActions(asset, pendingUpdate, hasCompletedRequiredUsageUpdate);
  const currentFuelPercent = normalizeFuelPercentText(draft.fuelPercent, asset?.fuelPercent ?? null);
  const showFuelAction = Boolean(asset?.canUpdateFuel);
  const serviceProfile = useMemo(() => resolveAssetServiceProfile(asset), [asset]);
  const checkedOptions = useMemo(() => checkedOptionsForProfile(serviceProfile), [serviceProfile]);
  const servicedOptions = useMemo(() => servicedOptionsForProfile(serviceProfile), [serviceProfile]);
  const serviceCopy = useMemo(() => serviceCopyForProfile(serviceProfile), [serviceProfile]);
  const prePinAsset = assetPreview;
  const hasServiceSelection = draft.serviceMode === "checked"
    ? draft.checkedItems.length > 0 || Boolean(draft.note.trim())
    : draft.serviceMode === "serviced"
      ? draft.servicedItems.length > 0 || Boolean(draft.note.trim())
      : draft.serviceMode === "repaired"
        ? Boolean(draft.repairDetails.trim())
        : false;
  const serviceDetailsMissing = (draft.serviceMode === "serviced" || draft.serviceMode === "repaired")
    && showServiceDetailsStep
    && (!draft.serviceCompany.trim() || !draft.mechanicName.trim());
  const saveBlockedByEmptyDraft = activeEditor === "photos"
    ? draft.photoUrls.length === 0
    : activeEditor === "service"
      ? !draft.serviceMode || !hasServiceSelection || serviceDetailsMissing
      : false;
  const canPressSave = !isSaving && !isUploading && !saveBlockedByEmptyDraft;
  const saveButtonLabel = isSaving
    ? "Saving…"
    : activeEditor === "photos" && !draft.photoUrls.length
      ? "Add photos"
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
            : activeEditor === "service" && (draft.serviceMode === "serviced" || draft.serviceMode === "repaired") && !showServiceDetailsStep
              ? "Next"
              : activeEditor === "usage" && usageUpdateRequired
                ? "Continue"
                : "Add update";
  const selectedSharePartner = useMemo(
    () => sharePartners.find((partner) => partner.userId === selectedSharePartnerId) ?? null,
    [sharePartners, selectedSharePartnerId],
  );
  const selectedSharePartnerPhoneHref = selectedSharePartner ? normalizePhoneHref(selectedSharePartner.phone) : "";
  const selectedSharePartnerEmailHref = selectedSharePartner ? normalizeEmailHref(selectedSharePartner.email) : "";
  const selectedSharePartnerWebsiteHref = selectedSharePartner ? normalizeWebsiteHref(selectedSharePartner.websiteUrl) : "";
  const sharePartnersWithCoordinates = useMemo(
    () => sharePartners.filter(hasDealerPartnerCoordinates),
    [sharePartners],
  );

  if (isDone) {
    return (
      <main className={styles.page}>
        <section className={styles.thankYouScreen}>
          <h1>Thank you.</h1>
          <p>The QR update session is closed.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {notice ? (
          <div className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        {!asset && !isUnavailable ? (
          <section className={`${styles.pinCard} ${!locationReady ? styles.pinCardBlocked : ""}`}>
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
                  onChange={(event) => setPin(normalizePinInput(event.target.value))}
                  disabled={isSubmittingPin || isLoadingAsset || !locationReady}
                />
              </label>

              <label className={styles.field}>
                <span>Your name</span>
                <input
                  autoComplete="name"
                  placeholder="Name of person scanning"
                  value={operatorName}
                  onChange={(event) => setOperatorName(normalizeOperatorName(event.target.value))}
                  disabled={isSubmittingPin || isLoadingAsset || !locationReady}
                />
              </label>

              {locationReady ? (
                <div className={`${styles.locationGate} ${styles.locationGateReady}`}>
                  <div>
                    <strong>Location ready</strong>
                    <span>{locationMessage}</span>
                  </div>
                  <button type="button" onClick={() => void captureLocation(false)} disabled={locationState === "capturing"}>
                    {locationState === "capturing" ? "Capturing..." : "Recapture GPS"}
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
                {isSubmittingPin || isLoadingAsset ? "Opening…" : "Unlock asset"}
              </button>
            </form>

            {!locationReady ? (
              <div className={styles.locationPromptBackdrop} role="dialog" aria-modal="true" aria-labelledby="asset-location-title">
                <div className={styles.locationPromptCard}>
                  <div className={styles.locationPromptIcon} aria-hidden="true">⌖</div>
                  <h2 id="asset-location-title">Keep location on</h2>
                  <p>Every QR save stores a GPS point automatically. Allow location access on this phone before saving updates.</p>
                  <span>{locationMessage}</span>
                  <button type="button" className={styles.primaryButton} onClick={() => void captureLocation(false)} disabled={locationState === "capturing"}>
                    {locationState === "capturing" ? "Capturing..." : "Continue"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {isUnavailable ? (
          <section className={styles.unavailableCard}>
            <h2>This asset could not be opened</h2>
            <p>
              Check the QR code, or ask the owner to confirm that the farm scan PIN is enabled for this account.
            </p>
          </section>
        ) : null}

        {asset ? (
          <>
            <section className={styles.assetOpenedCard}>
              <div className={styles.assetScanTitleBlock}>
                <span>Asset QR update</span>
                <h1>{asset.title}</h1>
                <p>{assetScanMeta(asset)}</p>
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
                <button type="button" className={styles.primaryButton} onClick={() => openEditor("usage")} disabled={isSaving || isUploading}>
                  {requiredUsageButtonLabel(asset)}
                </button>
              </section>
            ) : (
              <>
                <section className={styles.actionGrid}>
                  <button type="button" className={styles.actionCard} onClick={handleShareTap}>
                    <span className={styles.actionIconWrap}><ShareIcon className={styles.actionIcon} /></span>
                    <span className={styles.actionTextBlock}>
                      <strong>Share</strong>
                      <small>Dealer help</small>
                    </span>
                  </button>

                  <button type="button" className={styles.actionCard} onClick={handleFuelTap}>
                    <span className={styles.actionIconWrap}><FuelIcon className={styles.actionIcon} /></span>
                    <span className={styles.actionTextBlock}>
                      <strong>Fuel</strong>
                      <small>{showFuelAction ? buildEditorSummary("fuel", asset) : "Not enabled"}</small>
                    </span>
                  </button>

                  <button type="button" className={styles.actionCard} onClick={() => openEditor("service")}>
                    <span className={styles.actionIconWrap}><WrenchIcon className={styles.actionIcon} /></span>
                    <span className={styles.actionTextBlock}>
                      <strong>Maintenance</strong>
                      <small>{buildEditorSummary("service", asset)}</small>
                    </span>
                  </button>

                  <button type="button" className={styles.actionCard} onClick={() => openEditor("photos")}>
                    <span className={styles.actionIconWrap}><CameraIcon className={styles.actionIcon} /></span>
                    <span className={styles.actionTextBlock}>
                      <strong>Photos</strong>
                      <small>{buildEditorSummary("photos", asset)}</small>
                    </span>
                  </button>
                </section>

                <button type="button" className={styles.doneButton} onClick={() => void handleDone()} disabled={isSaving || isUploading}>
                  {isSaving && hasPendingScanUpdate(pendingUpdate) ? "Saving…" : "Done"}
                </button>
              </>
            )}
          </>
        ) : null}
      </div>

      {asset && showLocationReminder && !activeEditor ? (
        <div className={styles.locationReminderOverlay}>
          <div className={styles.modalBackdrop} />
          <div className={styles.locationReminderModal} role="dialog" aria-modal="true" aria-labelledby="location-reminder-title">
            <div className={styles.locationReminderIcon}>
              <LocationIcon className={styles.locationReminderSvg} />
            </div>
            <h3 id="location-reminder-title">Keep location on</h3>
            <p>
              Every QR save stores a GPS point automatically. Allow location access on this phone before saving updates.
            </p>
            <button type="button" className={styles.primaryButton} onClick={() => setShowLocationReminder(false)}>
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {asset && isShareModalOpen ? (
        <div className={styles.shareOverlay}>
          <div className={styles.modalBackdrop} onClick={closeShareModal} />
          <section className={styles.shareModal} role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
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
              <button type="button" className={styles.iconButton} onClick={closeShareModal} aria-label="Close dealer share">
                <CloseIcon className={styles.closeIcon} />
              </button>
            </header>

            {!shareLeadStep ? (
              <div className={styles.shareBody}>
                <form className={styles.shareSearchBar} onSubmit={handleShareSearchSubmit}>
                  <input
                    type="search"
                    placeholder="Search dealer, town, province or brand"
                    value={sharePartnerSearch}
                    onChange={(event) => setSharePartnerSearch(event.target.value)}
                  />
                  <button type="submit" className={styles.secondaryButton} disabled={isLoadingSharePartners}>
                    {isLoadingSharePartners ? "Loading…" : "Search"}
                  </button>
                </form>

                <div className={styles.shareMapStage}>
                  <div className={styles.shareMapShell}>
                    {isLoadingSharePartners && !sharePartnersWithCoordinates.length ? (
                      <div className={styles.shareMapFallback}>Loading approved dealers…</div>
                    ) : sharePartnersWithCoordinates.length ? (
                      <div ref={shareMapElementRef} className={styles.shareMapCanvas} aria-label="Dealer map" />
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
                      <small>{dealerPartnerAddress(selectedSharePartner) || dealerPartnerLocation(selectedSharePartner)}</small>
                    </div>
                  </div>

                  <div className={styles.shareContactList}>
                    {selectedSharePartner.phone && selectedSharePartnerPhoneHref ? <a href={selectedSharePartnerPhoneHref}>Call {selectedSharePartner.phone}</a> : null}
                    {selectedSharePartner.email && selectedSharePartnerEmailHref ? <a href={selectedSharePartnerEmailHref}>Email {selectedSharePartner.email}</a> : null}
                    {selectedSharePartner.websiteUrl && selectedSharePartnerWebsiteHref ? (
                      <a href={selectedSharePartnerWebsiteHref} target="_blank" rel="noreferrer">
                        {formatWebsiteDisplay(selectedSharePartner.websiteUrl)}
                      </a>
                    ) : null}
                  </div>

                  <label className={`${styles.field} ${styles.shareMessageField}`}>
                    <span>Message to dealer</span>
                    <textarea
                      value={shareOwnerMessage}
                      onChange={(event) => setShareOwnerMessage(event.target.value.slice(0, 1600))}
                      placeholder="Example: Please quote repair help or replacement parts for this asset."
                    />
                  </label>
                </div>
                <footer className={styles.shareFooter}>
                  <button type="button" className={styles.secondaryButton} onClick={goBackToShareMap} disabled={isSendingShareLead || isSaving}>
                    Back
                  </button>
                  <button type="button" className={styles.primaryButton} onClick={goToShareConsent} disabled={isSendingShareLead || isSaving}>
                    Next
                  </button>
                </footer>
              </>
            ) : shareLeadStep === "consent" && selectedSharePartner ? (
              <>
                <div className={styles.shareBody}>
                  <div className={styles.shareStepHeader}>
                    <strong>{dealerPartnerName(selectedSharePartner)}</strong>
                    <span>The asset will be sent as a replacement quote / dealer help lead.</span>
                  </div>

                  <div className={styles.sharePopiaBox}>
                    <strong>Information included</strong>
                    <p>Asset details, latest QR update, serial number, valuation summary, main photos and relevant documents will be shared with this dealer so they can respond through Aim4price.</p>
                  </div>

                  <label className={styles.shareConsentCheck}>
                    <input
                      type="checkbox"
                      checked={shareConsentAccepted}
                      onChange={(event) => setShareConsentAccepted(event.target.checked)}
                    />
                    <span>I confirm this asset may be sent to the selected dealer for help.</span>
                  </label>
                </div>
                <footer className={styles.shareFooter}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setShareLeadStep("message")} disabled={isSendingShareLead || isSaving}>
                    Back
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void handleSendDealerShareLead()}
                    disabled={isSendingShareLead || isSaving || !shareConsentAccepted}
                  >
                    {isSendingShareLead || isSaving ? "Sending…" : "Send to dealer"}
                  </button>
                </footer>
              </>
            ) : (
              <div className={styles.shareBody}>
                <div className={styles.shareEmptyState}>Choose a dealer again before sending.</div>
                <button type="button" className={styles.secondaryButton} onClick={goBackToShareMap}>
                  Back to dealers
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {asset && activeEditor ? (
        <div className={styles.editorOverlay}>
          <div className={`${styles.editorCard} ${activeEditor && activeEditor !== "usage" ? styles.actionEditorCard : ""} ${activeEditor === "fuel" ? styles.fuelEditorCard : ""}`} role="dialog" aria-modal="true" aria-labelledby="scan-editor-title">
            <div className={styles.editorHeader}>
              <div className={styles.editorTitleBlock}>
                <h3 id="scan-editor-title">
                  {activeEditor === "usage"
                    ? asset.usageMode === "km"
                      ? "Capture the latest kilometres"
                      : asset.usageMode === "hours"
                        ? "Capture the latest hours"
                        : "Update worked percentage"
                    : activeEditor === "fuel"
                      ? "Fuel level"
                      : activeEditor === "service"
                        ? draft.serviceMode === "checked"
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
                        : "Add photos"}
                </h3>
                <p>
                  {activeEditor === "usage"
                    ? asset.usageMode === "percent"
                      ? "Enter the current percentage worked."
                      : "Use the latest reading shown on the machine."
                    : activeEditor === "fuel"
                      ? "Save the asset fuel gauge as it is now."
                      : activeEditor === "service"
                        ? draft.serviceMode === "checked"
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
                        : "Upload or take photos."}
                </p>
              </div>

              <button type="button" className={styles.iconButton} onClick={closeEditor} aria-label="Close editor">
                <CloseIcon className={styles.closeIcon} />
              </button>
            </div>

            <div className={styles.editorBody}>
              {activeEditor === "usage" && asset.usageMode !== "none" ? (
                <div className={styles.centerStack}>
                  <label className={styles.field}>
                    <span>{usageModalLabel(asset)}</span>
                    <input
                      className={styles.largeInput}
                      inputMode="numeric"
                      placeholder={usagePlaceholder(asset)}
                      value={asset.usageMode === "percent" ? draft.lifeWorkedPercent : draft.hours}
                      onChange={(event) =>
                        setDraft((current) =>
                          asset.usageMode === "percent"
                            ? {
                                ...current,
                                lifeWorkedPercent: normalizePercentInput(event.target.value),
                                hours: "",
                              }
                            : {
                                ...current,
                                hours: normalizeIntegerInput(event.target.value),
                                lifeWorkedPercent: "",
                              },
                        )
                      }
                      disabled={isSaving}
                    />
                  </label>
                  <p className={styles.helperText}>
                    Current saved reading: {formatUsage(asset)}
                  </p>
                </div>
              ) : null}

              {activeEditor === "fuel" ? (
                <div className={styles.fuelSliderBlock}>
                  <div className={styles.fuelValueRow}>
                    <strong>{currentFuelPercent}%</strong>
                    <span>Asset fuel gauge</span>
                  </div>
                  <div className={styles.sliderTrackWrap}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      className={styles.rangeInput}
                      value={currentFuelPercent}
                      style={{
                        background: `linear-gradient(90deg, #176b4f 0%, #176b4f ${currentFuelPercent}%, #dce8e4 ${currentFuelPercent}%, #dce8e4 100%)`,
                      }}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          fuelPercent: normalizeFuelPercentText(event.target.value),
                        }))
                      }
                      disabled={isSaving}
                    />
                    <div className={styles.fuelScale}>
                      <span>Empty</span>
                      <span>Full</span>
                    </div>
                  </div>
                  <div className={styles.quickFuelGrid}>
                    {QUICK_FUEL_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={`${styles.quickFuelButton} ${currentFuelPercent === String(option) ? styles.quickFuelButtonActive : ""}`}
                        onClick={() => setDraft((current) => ({ ...current, fuelPercent: String(option) }))}
                        disabled={isSaving}
                      >
                        {option}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeEditor === "service" ? (
                <div className={styles.modalStack}>
                  <div className={`${styles.serviceModeGrid} ${draft.serviceMode ? styles.serviceModeGridLocked : ""}`}>
                    {!draft.serviceMode ? (
                      <>
                        <button
                          type="button"
                          className={styles.serviceModeCard}
                          onClick={() => {
                            setShowServiceDetailsStep(false);
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
                            <CheckCircleIcon className={styles.serviceModeSvg} />
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
                      <div className={`${styles.serviceModeCard} ${styles.serviceModeCardActive} ${styles.serviceModeCardLocked}`}>
                        <span className={styles.serviceModeIcon}>
                          {draft.serviceMode === "checked" ? (
                            <CheckCircleIcon className={styles.serviceModeSvg} />
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
                          const selected = draft.checkedItems.includes(option.label);

                          return (
                            <button
                              type="button"
                              key={option.label}
                              className={`${styles.listOptionButton} ${selected ? styles.listOptionActive : ""}`}
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  checkedItems: toggleValue(current.checkedItems, option.label),
                                }))
                              }
                              disabled={isSaving}
                            >
                              <span className={styles.listOptionText}>
                                <strong>{option.label}</strong>
                                <small>{option.description}</small>
                              </span>
                              <span className={styles.listOptionCheck}>{selected ? "✓" : ""}</span>
                            </button>
                          );
                        })}
                      </div>

                      {draft.checkedItems.length ? (
                        <p className={styles.selectedSummary}>
                          {draft.checkedItems.length} checked item{draft.checkedItems.length === 1 ? "" : "s"} selected.
                        </p>
                      ) : null}

                      <label className={styles.field}>
                        <span>Notes</span>
                        <textarea
                          placeholder={serviceCopy.checkedNotePlaceholder}
                          value={draft.note}
                          onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value.slice(0, 1600) }))}
                          disabled={isSaving}
                        />
                      </label>
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
                              const selected = draft.servicedItems.includes(option.label);

                              return (
                                <button
                                  type="button"
                                  key={option.label}
                                  className={`${styles.listOptionButton} ${selected ? styles.listOptionActive : ""}`}
                                  onClick={() =>
                                    setDraft((current) => ({
                                      ...current,
                                      servicedItems: toggleValue(current.servicedItems, option.label),
                                    }))
                                  }
                                  disabled={isSaving}
                                >
                                  <span className={styles.listOptionText}>
                                    <strong>{option.label}</strong>
                                    <small>{option.description}</small>
                                  </span>
                                  <span className={styles.listOptionCheck}>{selected ? "✓" : ""}</span>
                                </button>
                              );
                            })}
                          </div>

                          {draft.servicedItems.length ? (
                            <p className={styles.selectedSummary}>
                              {draft.servicedItems.length} service item{draft.servicedItems.length === 1 ? "" : "s"} selected.
                            </p>
                          ) : null}

                          <label className={styles.field}>
                            <span>Notes</span>
                            <textarea
                              placeholder={serviceCopy.servicedNotePlaceholder}
                              value={draft.note}
                              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value.slice(0, 1600) }))}
                              disabled={isSaving}
                            />
                          </label>
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
                              onChange={(event) => setDraft((current) => ({ ...current, serviceCompany: event.target.value.slice(0, 120) }))}
                              disabled={isSaving}
                            />
                          </label>
                          <label className={styles.field}>
                            <span>{serviceCopy.mechanicLabel}</span>
                            <input
                              placeholder={serviceCopy.mechanicPlaceholder}
                              value={draft.mechanicName}
                              onChange={(event) => setDraft((current) => ({ ...current, mechanicName: event.target.value.slice(0, 120) }))}
                              disabled={isSaving}
                            />
                          </label>
                          <button type="button" className={styles.secondaryButton} onClick={() => setShowServiceDetailsStep(false)} disabled={isSaving}>
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
                              placeholder={serviceCopy.repairedNotePlaceholder}
                              value={draft.repairDetails}
                              onChange={(event) => setDraft((current) => ({ ...current, repairDetails: event.target.value.slice(0, 1600) }))}
                              disabled={isSaving}
                            />
                          </label>

                          <label className={styles.field}>
                            <span>Extra notes</span>
                            <textarea
                              className={styles.compactTextarea}
                              placeholder={serviceCopy.repairedExtraNotePlaceholder}
                              value={draft.note}
                              onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value.slice(0, 1600) }))}
                              disabled={isSaving}
                            />
                          </label>
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
                              onChange={(event) => setDraft((current) => ({ ...current, serviceCompany: event.target.value.slice(0, 120) }))}
                              disabled={isSaving}
                            />
                          </label>
                          <label className={styles.field}>
                            <span>{serviceCopy.mechanicLabel}</span>
                            <input
                              placeholder={serviceCopy.mechanicPlaceholder}
                              value={draft.mechanicName}
                              onChange={(event) => setDraft((current) => ({ ...current, mechanicName: event.target.value.slice(0, 120) }))}
                              disabled={isSaving}
                            />
                          </label>
                          <button type="button" className={styles.secondaryButton} onClick={() => setShowServiceDetailsStep(false)} disabled={isSaving}>
                            Back to repair details
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeEditor === "photos" ? (
                <div className={styles.modalStack}>
                  <div className={styles.mediaChoiceGrid}>
                    <button
                      type="button"
                      className={styles.mediaButton}
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isUploading || isSaving || draft.photoUrls.length >= MAX_QR_PHOTOS}
                    >
                      <span className={styles.mediaButtonIcon}>
                        <UploadIcon className={styles.mediaButtonSvg} />
                      </span>
                      <span>
                        <strong>Upload photos</strong>
                        <small>Gallery</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.mediaButton}
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isUploading || isSaving || draft.photoUrls.length >= MAX_QR_PHOTOS}
                    >
                      <span className={styles.mediaButtonIcon}>
                        <CameraIcon className={styles.mediaButtonSvg} />
                      </span>
                      <span>
                        <strong>Take photos</strong>
                        <small>Camera</small>
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
                      ? "Preparing and uploading photos…"
                      : `${draft.photoUrls.length} of ${MAX_QR_PHOTOS} photos ready for this update.`}
                  </p>

                  {draft.photoUrls.length ? (
                    <div className={styles.photoGrid}>
                      {draft.photoUrls.map((url, index) => (
                        <article key={`${url}-${index}`} className={styles.photoCard}>
                          <img src={url} alt={`QR update photo ${index + 1}`} className={styles.photoImage} />
                          <button type="button" className={styles.removePhotoButton} onClick={() => handleRemovePhoto(url)} disabled={isSaving}>
                            Remove
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className={styles.editorFooter}>
              <button type="button" className={styles.secondaryButton} onClick={closeEditor} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} disabled={!canPressSave} onClick={() => void handleSaveUpdate()}>
                {saveButtonLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
