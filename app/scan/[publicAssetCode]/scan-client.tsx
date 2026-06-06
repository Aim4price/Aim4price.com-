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
      checkedDescription: "Quick implement or tool inspection.",
      servicedDescription: "Routine service, workshop job or wear-part replacement.",
      repairedDescription: "Breakage, fault or repair completed.",
      checkedTitle: "Implement check",
      servicedTitle: "Implement service",
      repairedTitle: "Implement repair",
      checkedPrompt: "Tap each implement item that was inspected.",
      servicedPrompt: "Tap each job or replacement that was completed.",
      repairedPrompt: "Explain exactly what was repaired before saving the maintenance record.",
      checkedHeader: "What was checked?",
      checkedSubheader: "Select every implement item that was inspected.",
      servicedHeader: "What was serviced?",
      servicedSubheader: "Select all work completed, then continue to workshop details.",
      repairedHeader: "What was repaired?",
      repairedSubheader: "Write a clear repair note. Example: what failed, what was fixed and what was replaced.",
      detailsHeader: "Who completed the work?",
      detailsSubheader: "Add the company and technician name before saving.",
      companyLabel: "Company / Workshop",
      companyPlaceholder: "Company or workshop name",
      mechanicLabel: "Mechanic / Technician name",
      mechanicPlaceholder: "Mechanic or technician name",
      checkedNotePlaceholder: "Example: Bolts checked, pins checked, no visible cracks.",
      servicedNotePlaceholder: "Example: Replaced worn points, tightened bolts and greased pins.",
      repairedNotePlaceholder: "Example: Repaired cracked bracket, replaced two bushes and checked welds.",
      repairedExtraNotePlaceholder: "Optional: add extra repair notes, parts used or follow-up needed.",
    };
  }

  return {
    checkedDescription: "Quick driver or manager inspection.",
    servicedDescription: "Routine service, dealer or mechanic job.",
    repairedDescription: "Breakage, fault or repair completed.",
    checkedTitle: "Machine check",
    servicedTitle: "Machine service",
    repairedTitle: "Machine repair",
    checkedPrompt: "Tap each item that was inspected.",
    servicedPrompt: "Tap each job that was completed.",
    repairedPrompt: "Explain exactly what was repaired before saving the maintenance record.",
    checkedHeader: "What was checked?",
    checkedSubheader: "Select every item that was inspected.",
    servicedHeader: "What was serviced?",
    servicedSubheader: "Select all work completed, then continue to company details.",
    repairedHeader: "What was repaired?",
    repairedSubheader: "Write a clear repair note. Example: what failed, what was fixed and what was replaced.",
    detailsHeader: "Who completed the service?",
    detailsSubheader: "Add the company and mechanic name before saving.",
    companyLabel: "Company / Dealer",
    companyPlaceholder: "Company or dealer name",
    mechanicLabel: "Mechanic name",
    mechanicPlaceholder: "Mechanic name",
    checkedNotePlaceholder: "Example: Oil checked, tyres checked, no visible leaks.",
    servicedNotePlaceholder: "Example: Full service completed, oil and filters replaced.",
    repairedNotePlaceholder: "Example: Repaired hydraulic leak, replaced hose and tested pressure.",
    repairedExtraNotePlaceholder: "Optional: add extra repair notes, parts used or follow-up needed.",
  };
}

function buildEditorSummary(editor: EditorKey, asset: ScanSafeAsset | null): string {
  if (editor === "usage") return formatUsage(asset);

  if (editor === "fuel") {
    return asset?.fuelPercent !== null && typeof asset?.fuelPercent !== "undefined"
      ? `${formatFuel(asset.fuelPercent)} current level`
      : "Capture current tank level";
  }

  if (editor === "service") return "Check asset, note service, or note repairs.";

  if (asset?.photos.length) {
    return `${asset.photos.length} photo${asset.photos.length === 1 ? "" : "s"} stored`;
  }

  return "Upload or take photos";
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
  const [showServiceDetailsStep, setShowServiceDetailsStep] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const autoLocationKeyRef = useRef<string>("");

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
    setShowServiceDetailsStep(false);
    setLocationState("idle");
    setLocationMessage(
      "Location must be enabled before this asset QR can continue.",
    );
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
    if (!activeEditor) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeEditor]);

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

      setAsset(data.asset);
      setSavedAsset(data.asset);
      setAssetPreview(data.asset);
      setDraft((current) => ({
        ...initialDraft,
        latitude: current.latitude,
        longitude: current.longitude,
      }));
      setPendingUpdate(initialPendingUpdate);
      setIsDone(false);
      setShowLocationReminder(false);
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
    setDraft((current) => {
      const nextDraft = keepCurrentLocation(current);

      if (!asset) return nextDraft;

      if (nextEditor === "usage") {
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

      if (nextEditor === "fuel") {
        const stagedFuel = pendingUpdate.hasFuel && pendingUpdate.fuelPercent
          ? pendingUpdate.fuelPercent
          : String(Math.round(asset.fuelPercent ?? 100));

        return { ...nextDraft, fuelPercent: stagedFuel };
      }

      if (nextEditor === "photos") {
        return { ...nextDraft, photoUrls: pendingUpdate.photoUrls };
      }

      return nextDraft;
    });

    setShowServiceDetailsStep(false);
    setActiveEditor(nextEditor);
  }

  function closeEditor() {
    setDraft((current) => keepCurrentLocation(current));
    setShowServiceDetailsStep(false);
    setActiveEditor(null);
  }

  function handleShareTap() {
    setNotice({ tone: "success", message: "Share button added for the new layout. The share action can be connected next." });
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
      if (!draft.fuelPercent.trim()) return { ok: false, message: "Choose the current tank level." };
      return { ok: true };
    }

    if (activeEditor === "service") {
      if (!draft.serviceMode) return { ok: false, message: "Choose a maintenance type." };

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

  async function handleDone() {
    if (!asset) {
      closeDoneSession();
      return;
    }

    if (!hasPendingScanUpdate(pendingUpdate)) {
      closeDoneSession();
      return;
    }

    const finalLatitude = pendingUpdate.latitude || draft.latitude;
    const finalLongitude = pendingUpdate.longitude || draft.longitude;

    if (operatorName.trim().length < 2) {
      setNotice({ tone: "error", message: "Enter your name before saving." });
      return;
    }

    if (!finalLatitude.trim() || !finalLongitude.trim()) {
      setNotice({ tone: "error", message: "Location is required. Allow GPS before tapping Done." });
      void captureLocation(false);
      return;
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
      setPendingUpdate(initialPendingUpdate);
      setDraft(initialDraft);
      closeDoneSession();
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to save the QR update.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const locationReady = hasLocationCaptured(draft);
  const showUsageAction = asset ? asset.usageMode !== "none" : false;
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
      ? "Add photos first"
      : activeEditor === "service" && !draft.serviceMode
        ? "Choose maintenance type"
        : activeEditor === "service" && !hasServiceSelection
          ? draft.serviceMode === "checked"
            ? "Select checked items"
            : draft.serviceMode === "repaired"
              ? "Explain repair"
              : "Select service items"
          : serviceDetailsMissing
            ? "Complete details"
            : activeEditor === "service" && (draft.serviceMode === "serviced" || draft.serviceMode === "repaired") && !showServiceDetailsStep
              ? serviceProfile === "implement"
                ? "Next: workshop details"
                : "Next: company details"
              : "Add update";

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

            <section className={styles.actionGrid}>
              <button type="button" className={styles.actionCard} onClick={handleShareTap}>
                <span className={styles.actionIconWrap}><ShareIcon className={styles.actionIcon} /></span>
                <strong>Share</strong>
                <small>Coming next</small>
              </button>

              <button type="button" className={styles.actionCard} onClick={handleFuelTap}>
                <span className={styles.actionIconWrap}><FuelIcon className={styles.actionIcon} /></span>
                <strong>Fuel</strong>
                <small>{showFuelAction ? buildEditorSummary("fuel", asset) : "Fuel tracking not enabled"}</small>
              </button>

              <button type="button" className={styles.actionCard} onClick={() => openEditor("service")}>
                <span className={styles.actionIconWrap}><WrenchIcon className={styles.actionIcon} /></span>
                <strong>Maintenance</strong>
                <small>{buildEditorSummary("service", asset)}</small>
              </button>

              <button type="button" className={styles.actionCard} onClick={() => openEditor("photos")}>
                <span className={styles.actionIconWrap}><CameraIcon className={styles.actionIcon} /></span>
                <strong>Photos</strong>
                <small>{buildEditorSummary("photos", asset)}</small>
              </button>
            </section>

            <button type="button" className={styles.doneButton} onClick={() => void handleDone()} disabled={isSaving || isUploading}>
              {isSaving && hasPendingScanUpdate(pendingUpdate) ? "Saving…" : "Done"}
            </button>
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

      {asset && activeEditor ? (
        <div className={styles.editorOverlay}>
          <div className={styles.editorCard} role="dialog" aria-modal="true" aria-labelledby="scan-editor-title">
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
                      ? "Current tank level"
                      : activeEditor === "service"
                        ? draft.serviceMode === "checked"
                          ? serviceCopy.checkedTitle
                          : draft.serviceMode === "serviced"
                            ? showServiceDetailsStep
                              ? "Service details"
                              : serviceCopy.servicedTitle
                            : draft.serviceMode === "repaired"
                              ? showServiceDetailsStep
                                ? "Repair details"
                                : serviceCopy.repairedTitle
                              : "Maintenance"
                        : "Add fresh photos"}
                </h3>
                <p>
                  {activeEditor === "usage"
                    ? asset.usageMode === "percent"
                      ? "Enter the current percentage worked."
                      : "Use the latest reading shown on the machine."
                    : activeEditor === "fuel"
                      ? "Save the tank level as it is now."
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
                              : "Choose the maintenance update type."
                        : "Upload from gallery or take photos with the camera."}
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
                <div className={styles.centerStack}>
                  <div className={styles.fuelReadout}>
                    {draft.fuelPercent || (asset.fuelPercent !== null ? String(asset.fuelPercent) : "0")}%
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    className={styles.rangeInput}
                    value={draft.fuelPercent || (asset.fuelPercent !== null ? String(asset.fuelPercent) : "0")}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        fuelPercent: normalizeIntegerInput(event.target.value).slice(0, 3),
                      }))
                    }
                    disabled={isSaving}
                  />
                  <div className={styles.quickOptionGrid}>
                    {QUICK_FUEL_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={`${styles.choiceButton} ${draft.fuelPercent === String(option) ? styles.choiceButtonActive : ""}`}
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
                              ? "Complete this checked record before starting another update."
                              : draft.serviceMode === "repaired"
                                ? "Complete this repair record before starting another update."
                                : "Complete this service record before starting another update."}
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
                              placeholder={serviceCopy.repairedNotePlaceholder}
                              value={draft.repairDetails}
                              onChange={(event) => setDraft((current) => ({ ...current, repairDetails: event.target.value.slice(0, 1600) }))}
                              disabled={isSaving}
                            />
                          </label>

                          <label className={styles.field}>
                            <span>Extra notes</span>
                            <textarea
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
                            <strong>Who completed the repair?</strong>
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
                        <small>Choose from gallery</small>
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
                        <small>Open camera</small>
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
