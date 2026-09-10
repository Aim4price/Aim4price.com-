"use client";

import { currentWebsiteScale } from '../../lib/website-canvas';

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import DesktopNotificationSettings from "./notifications/notification-settings-client";
import AppHeader from "../../components/AppHeader";
import { isMiddlemanAccountSubtype } from "../../lib/middleman-account";
import styles from "./page.module.css";

type NoticeTone = "success" | "error";
type AccountNotice = {
  tone: NoticeTone;
  message: string;
};
type BusinessDetailsStep = 1 | 2 | 3;
type PartnerDirectoryStep = 1 | 2 | 3;
type AccountActionModal =
  | "notifications"
  | "business"
  | "scanPin"
  | "marketplace"
  | "discovery"
  | "partnerDirectory"
  | "password";

type AccountProfile = {
  userId: string;
  name: string;
  displayName: string;
  email: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  businessName: string;
  phone: string;
  accountType: string;
  accountSubtype: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
  discoveryParticipationEnabled: boolean;
  partnerDirectoryEnabled: boolean;
  partnerDirectoryStatus: string;
  partnerDescription: string;
  partnerLatitude: number | null;
  partnerLongitude: number | null;
  partnerServiceRadiusKm: number | null;
  partnerBrandFocus: string;
  partnerServices: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

type AccountScanPinStatus = {
  enabled: boolean;
  hasPin: boolean;
  updatedAtIso: string | null;
};

type ProfileApiResponse = {
  ok: boolean;
  profile?: AccountProfile;
  error?: string;
};

type ScanPinApiResponse = {
  ok: boolean;
  scanPin?: AccountScanPinStatus;
  error?: string;
};

type AccountClientProps = {
  initialProfile?: AccountProfile | null;
  initialScanPinStatus?: AccountScanPinStatus | null;
};

type ProfileDraft = {
  displayName: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  businessName: string;
  phone: string;
  accountType: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
  discoveryParticipationEnabled: boolean;
  partnerDirectoryEnabled: boolean;
  partnerDirectoryStatus: string;
  partnerDescription: string;
  partnerLatitude: string;
  partnerLongitude: string;
  partnerServiceRadiusKm: string;
  partnerBrandFocus: string;
  partnerServices: string;
};

const initialProfileDraft: ProfileDraft = {
  displayName: "",
  logoUrl: "",
  websiteUrl: "",
  extraPhotoUrls: [],
  businessName: "",
  phone: "",
  accountType: "owner",
  vatNumber: "",
  province: "",
  townCity: "",
  addressLine1: "",
  addressLine2: "",
  notes: "",
  marketplaceSellerName: "",
  marketplacePhone: "",
  marketplaceEmail: "",
  marketplaceLocation: "",
  discoveryParticipationEnabled: false,
  partnerDirectoryEnabled: false,
  partnerDirectoryStatus: "approved",
  partnerDescription: "",
  partnerLatitude: "",
  partnerLongitude: "",
  partnerServiceRadiusKm: "",
  partnerBrandFocus: "",
  partnerServices: "",
};

const emptyScanPinStatus: AccountScanPinStatus = {
  enabled: false,
  hasPin: false,
  updatedAtIso: null,
};

const PROFILE_COMPLETION_TOTAL = 7;
const MAX_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const DEFAULT_PARTNER_MAP_CENTER: [number, number] = [-29.0, 24.0];
const DEFAULT_PARTNER_MAP_ZOOM = 5;
const SELECTED_PARTNER_MAP_ZOOM = 11;
const LEAFLET_SCRIPT_ID = "aim4price-leaflet-script";
const LEAFLET_CSS_ID = "aim4price-leaflet-css";

let leafletLoaderPromise: Promise<any> | null = null;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  owner: "Owner",
  dealer: "Dealer",
  finance: "Finance — accountants, financiers and banks",
  insurance: "Insurance",
  broker: "Insurance",
  insurer: "Insurance",
  bank: "Finance",
};

type QuickActionIconName =
  | "notifications"
  | "business"
  | "registers"
  | "claim"
  | "pin"
  | "fieldManager"
  | "ownerApp"
  | "dealer"
  | "marketplace"
  | "showroom"
  | "discovery"
  | "directory"
  | "security"
  | "reset";

const ACCOUNT_DIALOG_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getAccountDialogFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(ACCOUNT_DIALOG_FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );
}

function keepFocusInsideAccountDialog(
  event: KeyboardEvent,
  dialog: HTMLElement,
) {
  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = getAccountDialogFocusableElements(dialog);

  if (!focusableElements.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (!dialog.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? lastElement : firstElement).focus();
    return;
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function QuickActionIcon({ name }: { name: QuickActionIconName }) {
  const svgProps = {
    "aria-hidden": true,
    focusable: "false",
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  } as const;

  const strokeProps = {
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    vectorEffect: "non-scaling-stroke",
  } as const;

  return (
    <span className={styles.quickActionIcon} aria-hidden="true">
      {name === "notifications" ? (
        <svg {...svgProps}><path {...strokeProps} d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path {...strokeProps} d="M10 21h4M12 2V1" /></svg>
      ) : name === "business" ? (
        <svg {...svgProps}>
          <path
            d="M5.25 20.25h13.5V8.2L12 4.35 5.25 8.2v12.05Z"
            fill="currentColor"
            opacity="0.14"
          />
          <path {...strokeProps} d="M5.25 20.25V8.2L12 4.35l6.75 3.85v12.05" />
          <path {...strokeProps} d="M9 20.25v-5.4h6v5.4" />
          <path {...strokeProps} d="M9.2 10.1h.02" />
          <path {...strokeProps} d="M12 10.1h.02" />
          <path {...strokeProps} d="M14.8 10.1h.02" />
        </svg>
      ) : null}

      {name === "registers" ? (
        <svg {...svgProps}>
          <path
            d="M7 5.25h10a2 2 0 0 1 2 2v11.5H7a2 2 0 0 1-2-2V7.25a2 2 0 0 1 2-2Z"
            fill="currentColor"
            opacity="0.14"
          />
          <path
            {...strokeProps}
            d="M7 5.25h10a2 2 0 0 1 2 2v11.5H7a2 2 0 0 1-2-2V7.25a2 2 0 0 1 2-2Z"
          />
          <path {...strokeProps} d="M8.6 9h6.8" />
          <path {...strokeProps} d="M8.6 12.25h6.8" />
          <path {...strokeProps} d="M8.6 15.5h4.5" />
          <path {...strokeProps} d="M16.75 5.25V3.75" />
        </svg>
      ) : null}

      {name === "claim" ? (
        <svg {...svgProps}>
          <path d="M4.75 8.25 12 4l7.25 4.25v8.1L12 20.5l-7.25-4.15v-8.1Z" fill="currentColor" opacity="0.14" />
          <path {...strokeProps} d="M4.75 8.25 12 4l7.25 4.25v8.1L12 20.5l-7.25-4.15v-8.1Z" />
          <path {...strokeProps} d="m4.95 8.4 7.05 4.05 7.05-4.05M12 12.45v8" />
          <path {...strokeProps} d="M8.6 9.75 12 11.7l3.4-1.95" />
        </svg>
      ) : null}

      {name === "pin" ? (
        <svg {...svgProps}>
          <rect
            x="5"
            y="10"
            width="14"
            height="10"
            rx="2.25"
            fill="currentColor"
            opacity="0.14"
          />
          <rect
            {...strokeProps}
            x="5"
            y="10"
            width="14"
            height="10"
            rx="2.25"
          />
          <path {...strokeProps} d="M8.25 10V7.8a3.75 3.75 0 0 1 7.5 0V10" />
          <path {...strokeProps} d="M12 14.25v1.9" />
          <circle cx="12" cy="13.25" r="0.75" fill="currentColor" />
        </svg>
      ) : null}

      {name === "fieldManager" ? (
        <svg {...svgProps}>
          <circle
            cx="9"
            cy="8"
            r="3.15"
            fill="currentColor"
            opacity="0.14"
          />
          <circle {...strokeProps} cx="9" cy="8" r="3.15" />
          <path
            {...strokeProps}
            d="M3.9 19.25c.45-3.2 2.35-5.05 5.1-5.05 2.1 0 3.7 1.05 4.55 2.95"
          />
          <path
            {...strokeProps}
            d="M16.95 12.9a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3Z"
          />
          <path {...strokeProps} d="m15.55 16.05.9.9 1.85-2" />
        </svg>
      ) : null}

      {name === "ownerApp" ? (
        <svg {...svgProps}>
          <rect
            x="5.5"
            y="3.25"
            width="13"
            height="17.5"
            rx="2.35"
            fill="currentColor"
            opacity="0.14"
          />
          <rect
            {...strokeProps}
            x="5.5"
            y="3.25"
            width="13"
            height="17.5"
            rx="2.35"
          />
          <circle {...strokeProps} cx="12" cy="9" r="2.05" />
          <path
            {...strokeProps}
            d="M8.65 15.5c.3-2.05 1.55-3.25 3.35-3.25s3.05 1.2 3.35 3.25"
          />
          <path {...strokeProps} d="M10.75 18.1h2.5" />
        </svg>
      ) : null}

      {name === "dealer" ? (
        <svg {...svgProps}>
          <path
            d="M4.75 19.25c.35-3.05 2.35-4.9 5.05-4.9s4.7 1.85 5.05 4.9H4.75Z"
            fill="currentColor"
            opacity="0.14"
          />
          <circle {...strokeProps} cx="9.8" cy="8.25" r="3.1" />
          <path {...strokeProps} d="M4.75 19.25c.35-3.05 2.35-4.9 5.05-4.9s4.7 1.85 5.05 4.9" />
          <path {...strokeProps} d="M15.6 9.25h3.65v7.25H15.6" />
          <path {...strokeProps} d="M17.4 12.9h.02" />
        </svg>
      ) : null}

      {name === "marketplace" ? (
        <svg {...svgProps}>
          <path
            d="M6.3 8.7h11.4l-.9 10.05H7.2L6.3 8.7Z"
            fill="currentColor"
            opacity="0.14"
          />
          <path {...strokeProps} d="M6.3 8.7h11.4l-.9 10.05H7.2L6.3 8.7Z" />
          <path {...strokeProps} d="M9 8.7a3 3 0 0 1 6 0" />
          <path {...strokeProps} d="M9.6 13.1h4.8" />
          <path {...strokeProps} d="M10.7 15.55h2.6" />
        </svg>
      ) : null}

      {name === "showroom" ? (
        <svg {...svgProps}>
          <path
            d="M4.25 9.4h15.5v10.35H4.25V9.4Z"
            fill="currentColor"
            opacity="0.14"
          />
          <path {...strokeProps} d="M4.25 9.4h15.5v10.35H4.25V9.4Z" />
          <path {...strokeProps} d="m3.5 9.4 1.7-4.15h13.6l1.7 4.15" />
          <path {...strokeProps} d="M8.1 19.75v-5.5h7.8v5.5M3.5 9.4h17" />
        </svg>
      ) : null}

      {name === "discovery" ? (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="7.7" fill="currentColor" opacity="0.14" />
          <circle {...strokeProps} cx="12" cy="12" r="7.7" />
          <path {...strokeProps} d="m9.2 14.8 1.65-4.15 4.15-1.65-1.65 4.15-4.15 1.65Z" />
          <path {...strokeProps} d="M12 4.3v1.2M12 18.5v1.2M4.3 12h1.2M18.5 12h1.2" />
        </svg>
      ) : null}

      {name === "directory" ? (
        <svg {...svgProps}>
          <path
            d="M12 21s6.7-4.8 6.7-11a6.7 6.7 0 1 0-13.4 0C5.3 16.2 12 21 12 21Z"
            fill="currentColor"
            opacity="0.14"
          />
          <path
            {...strokeProps}
            d="M12 21s6.7-4.8 6.7-11a6.7 6.7 0 1 0-13.4 0C5.3 16.2 12 21 12 21Z"
          />
          <circle {...strokeProps} cx="12" cy="10" r="2.35" />
          <path {...strokeProps} d="M8.4 18.55h7.2" />
        </svg>
      ) : null}

      {name === "security" ? (
        <svg {...svgProps}>
          <path
            d="M6.2 10.15V8.1a5.8 5.8 0 0 1 11.6 0v2.05"
            fill="currentColor"
            opacity="0.14"
          />
          <rect
            x="4.8"
            y="10.15"
            width="14.4"
            height="10"
            rx="2.4"
            fill="currentColor"
            opacity="0.14"
          />
          <path {...strokeProps} d="M7.8 10.15V8.1a4.2 4.2 0 0 1 8.4 0v2.05" />
          <rect {...strokeProps} x="4.8" y="10.15" width="14.4" height="10" rx="2.4" />
          <circle cx="12" cy="14.65" r="1.05" fill="currentColor" />
          <path {...strokeProps} d="M12 15.7v1.35" />
        </svg>
      ) : null}

      {name === "reset" ? (
        <svg {...svgProps}>
          <rect
            x="3.75"
            y="5.5"
            width="16.5"
            height="13"
            rx="2.35"
            fill="currentColor"
            opacity="0.14"
          />
          <rect {...strokeProps} x="3.75" y="5.5" width="16.5" height="13" rx="2.35" />
          <path {...strokeProps} d="m5.25 7.35 6.75 5.1 6.75-5.1" />
          <path {...strokeProps} d="M15.5 16.1h3.2M17.1 14.5v3.2" />
        </svg>
      ) : null}

    </span>
  );
}

function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet can only load in the browser."));
  }

  const existingLeaflet = (window as any).L;

  if (existingLeaflet) {
    return Promise.resolve(existingLeaflet);
  }

  if (leafletLoaderPromise) {
    return leafletLoaderPromise;
  }

  leafletLoaderPromise = new Promise((resolve, reject) => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement("link");
      link.id = LEAFLET_CSS_ID;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const resolveIfReady = () => {
      const nextLeaflet = (window as any).L;

      if (nextLeaflet) {
        resolve(nextLeaflet);
        return true;
      }

      return false;
    };

    if (resolveIfReady()) {
      return;
    }

    let script = document.getElementById(
      LEAFLET_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = LEAFLET_SCRIPT_ID;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.body.appendChild(script);
    }

    script.addEventListener("load", () => {
      if (!resolveIfReady()) {
        reject(new Error("Leaflet did not initialise correctly."));
      }
    });
    script.addEventListener("error", () =>
      reject(new Error("Failed to load the map.")),
    );
  });

  return leafletLoaderPromise;
}

function parseCoordinate(value: string): number | null {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function readPartnerPin(
  profile: ProfileDraft,
): { lat: number; lng: number } | null {
  const lat = parseCoordinate(profile.partnerLatitude);
  const lng = parseCoordinate(profile.partnerLongitude);

  if (lat === null || lng === null) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  // South African partner locations should never have a zero latitude or longitude.
  // Treat a zero coordinate as an incomplete stale/manual value instead of centering the map in the ocean.
  if (Math.abs(lat) < 0.000001 || Math.abs(lng) < 0.000001) {
    return null;
  }

  return { lat, lng };
}

function formatCoordinate(value: number): string {
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function readServiceRadiusKm(value: string): number | null {
  const numeric = Number(String(value ?? "").trim());

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.min(Math.round(numeric), 2500);
}

function buildProfileLocation(profile: AccountProfile): string {
  return [profile.addressLine1, profile.townCity, profile.province]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function buildProfileDraft(profile: AccountProfile | null): ProfileDraft {
  if (!profile) {
    return initialProfileDraft;
  }

  const displayName = profile.displayName || profile.name;
  const fallbackLocation = buildProfileLocation(profile);

  return {
    displayName,
    logoUrl: profile.logoUrl,
    websiteUrl: profile.websiteUrl,
    extraPhotoUrls: [],
    businessName: profile.businessName,
    phone: profile.phone,
    accountType: profile.accountType || "owner",
    vatNumber: profile.vatNumber,
    province: profile.province,
    townCity: profile.townCity,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    notes: profile.notes,
    marketplaceSellerName:
      profile.marketplaceSellerName || profile.businessName || displayName,
    marketplacePhone: profile.marketplacePhone || profile.phone,
    marketplaceEmail: profile.marketplaceEmail,
    marketplaceLocation: profile.marketplaceLocation || fallbackLocation,
    discoveryParticipationEnabled: Boolean(
      profile.discoveryParticipationEnabled,
    ),
    partnerDirectoryEnabled: Boolean(profile.partnerDirectoryEnabled),
    partnerDirectoryStatus: profile.partnerDirectoryStatus || "approved",
    partnerDescription: profile.partnerDescription,
    partnerLatitude:
      profile.partnerLatitude === null ? "" : String(profile.partnerLatitude),
    partnerLongitude:
      profile.partnerLongitude === null ? "" : String(profile.partnerLongitude),
    partnerServiceRadiusKm:
      profile.partnerServiceRadiusKm === null
        ? ""
        : String(profile.partnerServiceRadiusKm),
    partnerBrandFocus: profile.partnerBrandFocus,
    partnerServices: profile.partnerServices,
  };
}

function formatMemberSince(value?: string | null): string {
  if (!value) return "Member since —";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Member since —";

  return `Member since ${new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(parsed)}`;
}

function formatUploadSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function countCompletedFields(profile: ProfileDraft): number {
  return [
    profile.displayName,
    profile.businessName,
    profile.phone,
    profile.marketplaceEmail,
    profile.province,
    profile.townCity,
    profile.addressLine1,
  ].filter((value) => String(value ?? "").trim()).length;
}

function buildAddressLines(profile: ProfileDraft): string[] {
  return [profile.addressLine1, profile.townCity, profile.province]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function normalizePinInput(value: string): string {
  return value.replace(/\D+/g, "").slice(0, 8);
}

function formatAccountTypeLabel(value: string, subtype = ''): string {
  const normalized = String(value ?? "").trim();
  const normalizedSubtype = String(subtype ?? "").trim().toLowerCase();

  if (!normalized) {
    return "Owner";
  }

  if (isMiddlemanAccountSubtype(normalizedSubtype)) return 'Middleman';
  if (normalized === 'finance' && normalizedSubtype === 'accountant') return 'Accountant';
  return ACCOUNT_TYPE_LABELS[normalized] ?? normalized;
}

function buildInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (!parts.length) {
    return "A4";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      result
        ? resolve(result)
        : reject(new Error("Failed to read image file."));
    };

    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text.trim() ? { message: text } : null;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const errorRecord =
    typeof record.error === "object" && record.error !== null
      ? (record.error as Record<string, unknown>)
      : null;
  const dataRecord =
    typeof record.data === "object" && record.data !== null
      ? (record.data as Record<string, unknown>)
      : null;

  const candidates = [
    record.message,
    record.error,
    record.reason,
    errorRecord?.message,
    errorRecord?.error,
    dataRecord?.message,
    dataRecord?.error,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return fallback;
}

function getResetPasswordUrl(): string {
  if (typeof window === "undefined") {
    return "/reset-password";
  }

  return new URL("/reset-password", window.location.origin).toString();
}

type AccountModalScrollerProps = {
  children?: ReactNode;
};

type AccountModalScrollbarState = {
  isScrollable: boolean;
  thumbHeight: number;
  thumbTop: number;
};

function AccountModalScroller({ children }: AccountModalScrollerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number;
    maxScrollTop: number;
    maxThumbTop: number;
  } | null>(null);
  const [scrollbarState, setScrollbarState] =
    useState<AccountModalScrollbarState>({
      isScrollable: false,
      thumbHeight: 0,
      thumbTop: 0,
    });

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    let animationFrameId = 0;

    const updateScrollbar = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(() => {
        const scrollHeight = viewport.scrollHeight;
        const clientHeight = viewport.clientHeight;
        const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
        const isScrollable = maxScrollTop > 2;

        if (!isScrollable) {
          setScrollbarState((current) => {
            if (
              !current.isScrollable &&
              current.thumbHeight === 0 &&
              current.thumbTop === 0
            ) {
              return current;
            }

            return {
              isScrollable: false,
              thumbHeight: 0,
              thumbTop: 0,
            };
          });
          return;
        }

        const trackHeight = Math.max(
          1,
          railRef.current?.clientHeight || clientHeight,
        );
        const minThumbHeight = Math.min(72, Math.max(46, trackHeight * 0.18));
        const thumbHeight = Math.min(
          trackHeight,
          Math.max(minThumbHeight, (clientHeight / scrollHeight) * trackHeight),
        );
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
        const thumbTop =
          maxScrollTop > 0
            ? (viewport.scrollTop / maxScrollTop) * maxThumbTop
            : 0;
        const nextState = {
          isScrollable: true,
          thumbHeight: Math.round(thumbHeight),
          thumbTop: Math.round(thumbTop),
        };

        setScrollbarState((current) => {
          if (
            current.isScrollable === nextState.isScrollable &&
            current.thumbHeight === nextState.thumbHeight &&
            current.thumbTop === nextState.thumbTop
          ) {
            return current;
          }

          return nextState;
        });
      });
    };

    updateScrollbar();
    viewport.addEventListener("scroll", updateScrollbar, { passive: true });
    window.addEventListener("resize", updateScrollbar);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollbar);

    if (resizeObserver) {
      resizeObserver.observe(viewport);

      if (contentRef.current) {
        resizeObserver.observe(contentRef.current);
      }

      if (railRef.current) {
        resizeObserver.observe(railRef.current);
      }
    }

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      viewport.removeEventListener("scroll", updateScrollbar);
      window.removeEventListener("resize", updateScrollbar);
      resizeObserver?.disconnect();
    };
  }, []);

  function handleScrollRailPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.target !== event.currentTarget || !scrollbarState.isScrollable) {
      return;
    }

    const viewport = viewportRef.current;
    const rail = railRef.current;

    if (!viewport || !rail) {
      return;
    }

    event.preventDefault();

    const railRect = rail.getBoundingClientRect();
    const pointerTop = (event.clientY - railRect.top) / currentWebsiteScale();
    const maxScrollTop = Math.max(
      0,
      viewport.scrollHeight - viewport.clientHeight,
    );
    const maxThumbTop = Math.max(
      1,
      rail.clientHeight - scrollbarState.thumbHeight,
    );
    const nextThumbTop = Math.min(
      maxThumbTop,
      Math.max(0, pointerTop - scrollbarState.thumbHeight / 2),
    );

    viewport.scrollTo({
      top: (nextThumbTop / maxThumbTop) * maxScrollTop,
      behavior: "smooth",
    });
  }

  function handleScrollThumbPointerDown(
    event: ReactPointerEvent<HTMLSpanElement>,
  ) {
    const viewport = viewportRef.current;
    const rail = railRef.current;

    if (!viewport || !rail || !scrollbarState.isScrollable) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: viewport.scrollTop,
      maxScrollTop: Math.max(0, viewport.scrollHeight - viewport.clientHeight),
      maxThumbTop: Math.max(1, rail.clientHeight - scrollbarState.thumbHeight),
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleScrollThumbPointerMove(
    event: ReactPointerEvent<HTMLSpanElement>,
  ) {
    const dragState = dragStateRef.current;
    const viewport = viewportRef.current;

    if (!dragState || !viewport || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const deltaY = (event.clientY - dragState.startY) / currentWebsiteScale();
    const nextScrollTop =
      dragState.startScrollTop +
      (deltaY / dragState.maxThumbTop) * dragState.maxScrollTop;

    viewport.scrollTop = Math.min(
      dragState.maxScrollTop,
      Math.max(0, nextScrollTop),
    );
  }

  function handleScrollThumbPointerEnd(
    event: ReactPointerEvent<HTMLSpanElement>,
  ) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
  }

  return (
    <div className={styles.accountModalScrollShell}>
      <div ref={viewportRef} className={styles.accountModalScrollViewport}>
        <div ref={contentRef} className={styles.accountModalScrollContent}>
          {children}
        </div>
      </div>

      <div
        ref={railRef}
        className={`${styles.accountModalScrollRail} ${scrollbarState.isScrollable ? styles.accountModalScrollRailVisible : ""}`}
        aria-hidden="true"
        onPointerDown={handleScrollRailPointerDown}
      >
        <span
          className={styles.accountModalScrollThumb}
          style={
            scrollbarState.isScrollable
              ? {
                  height: `${scrollbarState.thumbHeight}px`,
                  transform: `translate3d(0, ${scrollbarState.thumbTop}px, 0)`,
                }
              : undefined
          }
          onPointerDown={handleScrollThumbPointerDown}
          onPointerMove={handleScrollThumbPointerMove}
          onPointerUp={handleScrollThumbPointerEnd}
          onPointerCancel={handleScrollThumbPointerEnd}
        />
      </div>
    </div>
  );
}

function ModalStepProgress({
  currentStep,
  labels,
}: {
  currentStep: number;
  labels: readonly string[];
}) {
  return (
    <ol className={styles.modalStepProgress} aria-label="Setup progress">
      {labels.map((label, index) => {
        const step = index + 1;
        const isCurrent = currentStep === step;
        const isComplete = currentStep > step;

        return (
          <li
            key={label}
            className={`${styles.modalStep} ${isCurrent ? styles.modalStepCurrent : ""} ${isComplete ? styles.modalStepComplete : ""}`}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span>{isComplete ? "✓" : step}</span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function ModalInlineNotice({ notice }: { notice: AccountNotice | null }) {
  if (!notice) {
    return null;
  }

  return (
    <div
      className={`${styles.modalInlineNotice} ${notice.tone === "error" ? styles.modalInlineNoticeError : styles.modalInlineNoticeSuccess}`}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-live={notice.tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {notice.message}
    </div>
  );
}

export default function AccountClient({
  initialProfile = null,
  initialScanPinStatus = null,
}: AccountClientProps) {
  const [profile, setProfile] =
    useState<AccountProfile | null>(initialProfile);
  const [profileDraft, setProfileDraft] =
    useState<ProfileDraft>(() =>
      initialProfile ? buildProfileDraft(initialProfile) : initialProfileDraft,
    );
  const [scanPinStatus, setScanPinStatus] =
    useState<AccountScanPinStatus>(
      initialScanPinStatus ?? emptyScanPinStatus,
    );
  const [scanPinDraft, setScanPinDraft] = useState("");
  const [scanPinConfirmDraft, setScanPinConfirmDraft] = useState("");
  const [notice, setNotice] = useState<AccountNotice | null>(null);
  const [actionModalNotice, setActionModalNotice] =
    useState<AccountNotice | null>(null);
  const [isLoading, setIsLoading] = useState(!initialProfile);
  const [isLoadingScanPin, setIsLoadingScanPin] = useState(
    !initialScanPinStatus,
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingScanPin, setIsSavingScanPin] = useState(false);
  const [isDisablingScanPin, setIsDisablingScanPin] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordModalNotice, setPasswordModalNotice] =
    useState<AccountNotice | null>(null);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [isReadingLogo, setIsReadingLogo] = useState(false);
  const [activeAccountModal, setActiveAccountModal] =
    useState<AccountActionModal | null>(null);
  const [businessDetailsStep, setBusinessDetailsStep] =
    useState<BusinessDetailsStep>(1);
  const [partnerDirectoryStep, setPartnerDirectoryStep] =
    useState<PartnerDirectoryStep>(1);
  const activeDialogRef = useRef<HTMLElement | null>(null);
  const deleteDialogRef = useRef<HTMLElement | null>(null);
  const activeDialogTriggerRef = useRef<HTMLElement | null>(null);
  const deleteDialogTriggerRef = useRef<HTMLElement | null>(null);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const activeActionModalBusyRef = useRef(false);
  const deleteDialogBusyRef = useRef(false);
  const partnerMapElementRef = useRef<HTMLDivElement | null>(null);
  const partnerLeafletMapRef = useRef<any>(null);
  const partnerPinMarkerRef = useRef<any>(null);
  const partnerRadiusCircleRef = useRef<any>(null);

  activeActionModalBusyRef.current = isSavingNotifications ||
    isSavingProfile ||
    isReadingLogo ||
    isSavingScanPin ||
    isDisablingScanPin ||
    isChangingPassword;
  deleteDialogBusyRef.current = isDeletingAccount;

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/account-profile", {
          cache: "no-store",
          credentials: "include",
        });

        const data = (await response.json()) as ProfileApiResponse;

        if (!response.ok || !data.ok || !data.profile) {
          throw new Error(data.error ?? "Failed to load account profile.");
        }

        if (!mounted) {
          return;
        }

        setProfile(data.profile);
        setProfileDraft(buildProfileDraft(data.profile));
      } catch (error) {
        if (!mounted) {
          return;
        }

        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load account profile.",
        });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    async function loadScanPin() {
      setIsLoadingScanPin(true);

      try {
        const response = await fetch("/api/account-profile/scan-pin", {
          cache: "no-store",
          credentials: "include",
        });

        const data = (await response.json()) as ScanPinApiResponse;

        if (!response.ok || !data.ok || !data.scanPin) {
          throw new Error(data.error ?? "Failed to load scan PIN settings.");
        }

        if (!mounted) {
          return;
        }

        setScanPinStatus(data.scanPin);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load scan PIN settings.",
        });
      } finally {
        if (mounted) {
          setIsLoadingScanPin(false);
        }
      }
    }

    if (!initialProfile) {
      void loadProfile();
    }

    if (!initialScanPinStatus) {
      void loadScanPin();
    }

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice || notice.tone === "error") return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      return undefined;
    }

    const dialog = deleteDialogRef.current;
    const returnFocusTarget = deleteDialogTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocusTarget =
        dialog?.querySelector<HTMLElement>("[autofocus]") ??
        (dialog ? getAccountDialogFocusableElements(dialog)[0] : null) ??
        dialog;
      initialFocusTarget?.focus();
    });

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (dialog) {
        keepFocusInsideAccountDialog(event, dialog);
      }

      if (event.key === "Escape" && !deleteDialogBusyRef.current) {
        closeDeleteDialog();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeyDown);
      window.requestAnimationFrame(() => {
        if (returnFocusTarget?.isConnected) {
          returnFocusTarget.focus();
        }
      });
    };
  }, [isDeleteDialogOpen]);

  useEffect(() => {
    if (!activeAccountModal) {
      return undefined;
    }

    const dialog = activeDialogRef.current;
    const returnFocusTarget = activeDialogTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocusTarget =
        dialog?.querySelector<HTMLElement>("[autofocus]") ??
        (dialog ? getAccountDialogFocusableElements(dialog)[0] : null) ??
        dialog;
      initialFocusTarget?.focus();
    });

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (dialog) {
        keepFocusInsideAccountDialog(event, dialog);
      }

      if (event.key === "Escape" && !activeActionModalBusyRef.current) {
        closeActionModal();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeyDown);
      window.requestAnimationFrame(() => {
        if (returnFocusTarget?.isConnected) {
          returnFocusTarget.focus();
        }
      });
    };
  }, [activeAccountModal]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('notifications') === 'open') {
      openActionModal('notifications');
      url.searchParams.delete('notifications');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  }, []);

  const completedFields = useMemo(
    () => countCompletedFields(profileDraft),
    [profileDraft],
  );
  const completionPercentage = Math.round(
    (completedFields / PROFILE_COMPLETION_TOTAL) * 100,
  );
  const addressLines = useMemo(
    () => buildAddressLines(profileDraft),
    [profileDraft],
  );
  const accountTypeLabel = useMemo(
    () => formatAccountTypeLabel(profileDraft.accountType, profile?.accountSubtype),
    [profile?.accountSubtype, profileDraft.accountType],
  );
  const normalizedAccountType = String(
    profile?.accountType || profileDraft.accountType || "owner",
  )
    .trim()
    .toLowerCase();
  const isOwnerAccount = normalizedAccountType === "owner";
  const isDealerAccount = normalizedAccountType === "dealer";
  const isMiddlemanAccount =
    isDealerAccount && isMiddlemanAccountSubtype(profile?.accountSubtype);
  const isAssetRegisterAccount = isOwnerAccount || (isDealerAccount && !isMiddlemanAccount);
  const isPartnerAccount = !isOwnerAccount && !isMiddlemanAccount;
  const showScanPinControls = !isLoading && isOwnerAccount;
  const showPartnerDirectory = !isLoading && isPartnerAccount;
  const showMarketplaceContact = isLoading || isOwnerAccount || isDealerAccount;
  const accountDisplayName =
    profileDraft.displayName.trim() || profile?.name || "Aim4price user";
  const profileInitials = useMemo(
    () =>
      buildInitials(
        accountDisplayName || profileDraft.businessName || "Aim4price",
      ),
    [accountDisplayName, profileDraft.businessName],
  );
  const scanPinStatusLabel = scanPinStatus.enabled ? "Active" : "Disabled";
  const logoUrl = profileDraft.logoUrl.trim();
  const marketplaceSellerName =
    profileDraft.marketplaceSellerName.trim() ||
    profileDraft.businessName.trim() ||
    accountDisplayName;
  const marketplacePhone =
    profileDraft.marketplacePhone.trim() ||
    profileDraft.phone.trim() ||
    "No contact details saved yet";
  const marketplaceEmail =
    profileDraft.marketplaceEmail.trim() || "No business email saved yet";
  const marketplaceLocation =
    profileDraft.marketplaceLocation.trim() ||
    (addressLines.length ? addressLines.join(", ") : "No location saved yet");
  const partnerDirectoryPin = useMemo(
    () => readPartnerPin(profileDraft),
    [profileDraft.partnerLatitude, profileDraft.partnerLongitude],
  );
  const partnerDirectoryPinLabel = partnerDirectoryPin
    ? `${formatCoordinate(partnerDirectoryPin.lat)}, ${formatCoordinate(partnerDirectoryPin.lng)}`
    : "No map pin selected yet";
  const memberSinceLabel = formatMemberSince(profile?.createdAtIso);
  const directoryStatusLabel = profileDraft.partnerDirectoryEnabled
    ? "Visible"
    : "Hidden";
  const passwordsMatch =
    !confirmNewPassword || newPassword === confirmNewPassword;
  const canSubmitPasswordChange = Boolean(
    currentPassword &&
      newPassword.length >= 8 &&
      confirmNewPassword &&
      passwordsMatch &&
      !isChangingPassword,
  );
  const scanPinDisplayLabel = isLoadingScanPin
    ? "Loading"
    : scanPinStatus.hasPin
      ? scanPinStatusLabel
      : "Not set";

  useEffect(() => {
    if (
      isLoading ||
      !isPartnerAccount ||
      activeAccountModal !== "partnerDirectory" ||
      partnerDirectoryStep !== 2 ||
      !partnerMapElementRef.current
    ) {
      return undefined;
    }

    let cancelled = false;

    async function renderPartnerMap() {
      try {
        const L = await loadLeaflet();

        if (cancelled || !partnerMapElementRef.current) {
          return;
        }

        const selectedPin = readPartnerPin(profileDraft);
        const center = selectedPin
          ? [selectedPin.lat, selectedPin.lng]
          : DEFAULT_PARTNER_MAP_CENTER;
        const zoom = selectedPin
          ? SELECTED_PARTNER_MAP_ZOOM
          : DEFAULT_PARTNER_MAP_ZOOM;

        if (!partnerLeafletMapRef.current) {
          partnerLeafletMapRef.current = L.map(partnerMapElementRef.current, {
            zoomControl: true,
            scrollWheelZoom: true,
          }).setView(center, zoom);

          L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19,
            detectRetina: true,
          }).addTo(partnerLeafletMapRef.current);

          partnerLeafletMapRef.current.on("click", (event: any) => {
            setPartnerMapPin(event.latlng.lat, event.latlng.lng);
          });
        }

        if (partnerPinMarkerRef.current) {
          partnerPinMarkerRef.current.remove();
          partnerPinMarkerRef.current = null;
        }

        if (partnerRadiusCircleRef.current) {
          partnerRadiusCircleRef.current.remove();
          partnerRadiusCircleRef.current = null;
        }

        if (selectedPin) {
          const icon = L.divIcon({
            className: "accountPartnerMapMarker",
            html: '<span class="accountPartnerMapMarkerPin"><b>PIN</b></span>',
            iconSize: [46, 46],
            iconAnchor: [23, 46],
            popupAnchor: [0, -40],
          });

          const marker = L.marker([selectedPin.lat, selectedPin.lng], {
            draggable: true,
            icon,
            title: "Partner directory pin",
          }).addTo(partnerLeafletMapRef.current);

          marker.on("dragend", () => {
            const next = marker.getLatLng();
            setPartnerMapPin(next.lat, next.lng);
          });

          marker.bindPopup(
            `<strong>${accountDisplayName.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</strong><br />Partner directory pin`,
          );

          partnerPinMarkerRef.current = marker;

          const radiusKm = readServiceRadiusKm(
            profileDraft.partnerServiceRadiusKm,
          );

          if (radiusKm) {
            partnerRadiusCircleRef.current = L.circle(
              [selectedPin.lat, selectedPin.lng],
              {
                radius: radiusKm * 1000,
                color: "#1f8a66",
                fillColor: "#1f8a66",
                fillOpacity: 0.08,
                opacity: 0.38,
                weight: 2,
              },
            ).addTo(partnerLeafletMapRef.current);
          }

          partnerLeafletMapRef.current.setView(
            [selectedPin.lat, selectedPin.lng],
            Math.max(partnerLeafletMapRef.current.getZoom(), 8),
          );
        }

        window.requestAnimationFrame(() =>
          partnerLeafletMapRef.current?.invalidateSize(),
        );
        window.setTimeout(
          () => partnerLeafletMapRef.current?.invalidateSize(),
          80,
        );
        window.setTimeout(
          () => partnerLeafletMapRef.current?.invalidateSize(),
          320,
        );
      } catch (error) {
        if (!cancelled) {
          setActionModalNotice({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to load the map.",
          });
        }
      }
    }

    void renderPartnerMap();

    return () => {
      cancelled = true;
    };
  }, [
    accountDisplayName,
    activeAccountModal,
    isLoading,
    isPartnerAccount,
    partnerDirectoryStep,
    profileDraft.partnerLatitude,
    profileDraft.partnerLongitude,
    profileDraft.partnerServiceRadiusKm,
  ]);

  useEffect(() => {
    return () => {
      if (partnerLeafletMapRef.current) {
        partnerLeafletMapRef.current.remove();
        partnerLeafletMapRef.current = null;
        partnerPinMarkerRef.current = null;
        partnerRadiusCircleRef.current = null;
      }
    };
  }, []);

  function setPartnerMapPin(lat: number, lng: number) {
    setProfileDraft((current) => ({
      ...current,
      partnerLatitude: lat.toFixed(6),
      partnerLongitude: lng.toFixed(6),
    }));
  }

  function clearPartnerMapPin() {
    setProfileDraft((current) => ({
      ...current,
      partnerLatitude: "",
      partnerLongitude: "",
    }));
  }

  function handleUseCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setActionModalNotice({
        tone: "error",
        message: "Current location is not available in this browser.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPartnerMapPin(position.coords.latitude, position.coords.longitude);
        setActionModalNotice({
          tone: "success",
          message: "Map pin set. Continue to additional information when ready.",
        });
      },
      () => {
        setActionModalNotice({
          tone: "error",
          message:
            "Could not read your current location. Drop the pin manually on the map.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    const fileType = String(file.type ?? "")
      .trim()
      .toLowerCase();

    if (!ALLOWED_LOGO_TYPES.has(fileType)) {
      setActionModalNotice({
        tone: "error",
        message: "Upload a JPG, PNG or WEBP logo.",
      });
      return;
    }

    if (file.size > MAX_LOGO_UPLOAD_BYTES) {
      setActionModalNotice({
        tone: "error",
        message: `Logo must be ${formatUploadSize(MAX_LOGO_UPLOAD_BYTES)} or smaller.`,
      });
      return;
    }

    setIsReadingLogo(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProfileDraft((current) => ({ ...current, logoUrl: dataUrl }));
      setActionModalNotice({
        tone: "success",
        message: "Logo ready. Save the business details to apply it.",
      });
    } catch (error) {
      setActionModalNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to read image file.",
      });
    } finally {
      setIsReadingLogo(false);
    }
  }

  function handleRemoveLogo() {
    setProfileDraft((current) => ({ ...current, logoUrl: "" }));
    setActionModalNotice({
      tone: "success",
      message: "Logo removed from the draft. Save to apply the change.",
    });
  }

  async function saveProfileDraft(
    nextDraft: ProfileDraft,
    successMessage = "Account details saved.",
    options?: { syncPrimaryLogoToRegister?: boolean },
  ): Promise<boolean> {
    setIsSavingProfile(true);
    setActionModalNotice(null);

    const nextLogoUrl = nextDraft.logoUrl.trim();
    const currentLogoUrl = (profile?.logoUrl ?? "").trim();
    const shouldSyncPrimaryLogo = Boolean(
      options?.syncPrimaryLogoToRegister || nextLogoUrl !== currentLogoUrl,
    );

    try {
      const response = await fetch("/api/account-profile", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...nextDraft,
          discoveryParticipationEnabled: isOwnerAccount
            ? nextDraft.discoveryParticipationEnabled
            : undefined,
          extraPhotoUrls: [],
          syncPrimaryLogoToRegister: shouldSyncPrimaryLogo,
        }),
      });

      const data = (await response.json()) as ProfileApiResponse;

      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.error ?? "Failed to save account details.");
      }

      setProfile(data.profile);
      setProfileDraft(buildProfileDraft(data.profile));
      setNotice({ tone: "success", message: successMessage });
      return true;
    } catch (error) {
      setActionModalNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save account details.",
      });
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const didSave = await saveProfileDraft(profileDraft);

    if (didSave) {
      if (activeAccountModal === "partnerDirectory") {
        destroyPartnerMap();
      }

      setActiveAccountModal(null);
    }
  }

  function handleBusinessDetailsSubmit(event: FormEvent<HTMLFormElement>) {
    if (businessDetailsStep < 3) {
      event.preventDefault();
      setBusinessDetailsStep(
        (businessDetailsStep + 1) as BusinessDetailsStep,
      );
      return;
    }

    void handleProfileSubmit(event);
  }

  function handlePartnerDirectorySubmit(event: FormEvent<HTMLFormElement>) {
    if (partnerDirectoryStep < 3) {
      event.preventDefault();
      goToPartnerDirectoryStep(
        (partnerDirectoryStep + 1) as PartnerDirectoryStep,
      );
      return;
    }

    void handleProfileSubmit(event);
  }

  async function handleScanPinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionModalNotice(null);

    const normalizedPin = normalizePinInput(scanPinDraft);
    const normalizedConfirmPin = normalizePinInput(scanPinConfirmDraft);

    if (!normalizedPin) {
      setActionModalNotice({ tone: "error", message: "Enter a scan PIN." });
      return;
    }

    if (normalizedPin.length < 4 || normalizedPin.length > 8) {
      setActionModalNotice({
        tone: "error",
        message: "Scan PIN must be 4 to 8 digits.",
      });
      return;
    }

    if (normalizedPin !== normalizedConfirmPin) {
      setActionModalNotice({
        tone: "error",
        message: "Scan PINs do not match.",
      });
      return;
    }

    setIsSavingScanPin(true);

    try {
      const response = await fetch("/api/account-profile/scan-pin", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pin: normalizedPin,
          confirmPin: normalizedConfirmPin,
        }),
      });

      const payload = await readResponsePayload(response);
      const data = (payload ?? null) as ScanPinApiResponse | null;

      if (!response.ok || !data?.ok || !data.scanPin) {
        throw new Error(
          extractErrorMessage(payload, "Failed to save scan PIN."),
        );
      }

      setScanPinStatus(data.scanPin);
      setScanPinDraft("");
      setScanPinConfirmDraft("");
      setActiveAccountModal(null);
      setNotice({
        tone: "success",
        message: "Scan PIN saved. QR scan access is now active.",
      });
    } catch (error) {
      setActionModalNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to save scan PIN.",
      });
    } finally {
      setIsSavingScanPin(false);
    }
  }

  async function handleDisableScanPin() {
    setIsDisablingScanPin(true);
    setActionModalNotice(null);

    try {
      const response = await fetch("/api/account-profile/scan-pin", {
        method: "DELETE",
        credentials: "include",
      });

      const payload = await readResponsePayload(response);
      const data = (payload ?? null) as ScanPinApiResponse | null;

      if (!response.ok || !data?.ok || !data.scanPin) {
        throw new Error(
          extractErrorMessage(payload, "Failed to disable scan PIN."),
        );
      }

      setScanPinStatus(data.scanPin);
      setScanPinDraft("");
      setScanPinConfirmDraft("");
      setActiveAccountModal(null);
      setNotice({ tone: "success", message: "Scan PIN disabled." });
    } catch (error) {
      setActionModalNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to disable scan PIN.",
      });
    } finally {
      setIsDisablingScanPin(false);
    }
  }

  function closeDeleteDialog() {
    if (deleteDialogBusyRef.current) {
      return;
    }

    setIsDeleteDialogOpen(false);
    setDeletePassword("");
    setDeleteConfirmText("");
    setDeleteModalError(null);
  }

  function openDeleteDialog() {
    activeDialogTriggerRef.current = null;
    deleteDialogTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDeleteModalError(null);
    setIsDeleteDialogOpen(true);
  }

  function destroyPartnerMap() {
    if (partnerLeafletMapRef.current) {
      partnerLeafletMapRef.current.remove();
      partnerLeafletMapRef.current = null;
      partnerPinMarkerRef.current = null;
      partnerRadiusCircleRef.current = null;
    }
  }

  function closeActionModal() {
    if (activeActionModalBusyRef.current) {
      return;
    }

    destroyPartnerMap();

    if (profile) {
      setProfileDraft(buildProfileDraft(profile));
    }

    setScanPinDraft("");
    setScanPinConfirmDraft("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordModalNotice(null);
    setActionModalNotice(null);
    setBusinessDetailsStep(1);
    setPartnerDirectoryStep(1);
    setActiveAccountModal(null);
  }

  function openActionModal(modal: AccountActionModal) {
    destroyPartnerMap();
    setActionModalNotice(null);

    activeDialogTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (profile) {
      setProfileDraft(buildProfileDraft(profile));
    }

    if (modal === "scanPin") {
      setScanPinDraft("");
      setScanPinConfirmDraft("");
    }

    if (modal === "business") {
      setBusinessDetailsStep(1);
    }

    if (modal === "password") {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordModalNotice(null);
    }

    if (modal === "partnerDirectory") {
      setPartnerDirectoryStep(1);
    }

    setActiveAccountModal(modal);
  }

  function goToPartnerDirectoryStep(step: PartnerDirectoryStep) {
    if (partnerDirectoryStep === 2 && step !== 2) {
      destroyPartnerMap();
    }

    setPartnerDirectoryStep(step);
  }

  function openBusinessEditor() {
    openActionModal("business");
  }

  function openAssetRegistersPage() {
    window.location.assign("/asset-registers");
  }

  function openAssetTransfersPage() {
    window.location.assign("/account/asset-transfers");
  }

  function openMarketplaceEditor() {
    openActionModal("marketplace");
  }

  function openDiscoveryEditor() {
    openActionModal("discovery");
  }

  function openScanPinEditor() {
    openActionModal("scanPin");
  }

  function openFieldManagerPage() {
    window.location.assign("/account/field-manager");
  }

  function openDealerAppAccessPage() {
    window.location.assign("/account/dealer-app");
  }

  function openOwnerAppAccessPage() {
    window.location.assign("/account/owner-app");
  }

  function openPartnerDirectory() {
    openActionModal("partnerDirectory");
  }

  function openPasswordEditor() {
    openActionModal("password");
  }

  async function handlePasswordChangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordModalNotice(null);

    if (!currentPassword.trim()) {
      setPasswordModalNotice({
        tone: "error",
        message: "Enter your current password.",
      });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordModalNotice({
        tone: "error",
        message: "New password must be at least 8 characters.",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordModalNotice({
        tone: "error",
        message: "New passwords do not match.",
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        }),
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(
          extractErrorMessage(payload, "Failed to change password."),
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordModalNotice(null);
      setActiveAccountModal(null);
      setNotice({ tone: "success", message: "Password changed successfully." });
    } catch (error) {
      setPasswordModalNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to change password.",
      });
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleSendSelfResetEmail() {
    const email = profile?.email.trim();

    if (!email) {
      setNotice({
        tone: "error",
        message: "Account email is not available yet.",
      });
      return;
    }

    setIsSendingResetEmail(true);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          redirectTo: getResetPasswordUrl(),
        }),
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(
          extractErrorMessage(payload, "Failed to send reset password email."),
        );
      }

      setNotice({
        tone: "success",
        message:
          "Reset password email sent. Check your inbox for the secure link.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to send reset password email.",
      });
    } finally {
      setIsSendingResetEmail(false);
    }
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteModalError(null);

    if (!deletePassword.trim()) {
      setDeleteModalError("Enter your password to delete this account.");
      return;
    }

    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      setDeleteModalError("Type DELETE to confirm account removal.");
      return;
    }

    setIsDeletingAccount(true);

    try {
      const response = await fetch("/api/auth/delete-user", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: deletePassword,
          callbackURL: "/",
        }),
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(
          extractErrorMessage(payload, "Failed to delete account."),
        );
      }

      setNotice({
        tone: "success",
        message:
          "Your account and saved workspace data were deleted. Redirecting…",
      });
      setIsDeleteDialogOpen(false);
      setDeletePassword("");
      setDeleteConfirmText("");
      setDeleteModalError(null);

      window.setTimeout(() => {
        window.location.assign("/");
      }, 700);
    } catch (error) {
      setDeleteModalError(
        error instanceof Error ? error.message : "Failed to delete account.",
      );
    } finally {
      setIsDeletingAccount(false);
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.shell}>
        <section className={styles.accountHero}>
          <div className={styles.heroIdentityGroup}>
            <div className={styles.heroAvatarControl}>
              <label
                className={`${styles.heroAvatar} ${logoUrl ? styles.heroAvatarWithLogo : ""}`}
                title="Upload account logo"
                aria-label="Upload account logo"
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleLogoFileChange}
                  disabled={isReadingLogo || isSavingProfile}
                />
                {logoUrl ? (
                  <img src={logoUrl} alt="Business logo" />
                ) : (
                  <span>{profileInitials}</span>
                )}
              </label>
              <span className={styles.heroAvatarEditBadge} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M8 7.25 9.2 5.5h5.6L16 7.25h2.25A1.75 1.75 0 0 1 20 9v8.25A1.75 1.75 0 0 1 18.25 19H5.75A1.75 1.75 0 0 1 4 17.25V9a1.75 1.75 0 0 1 1.75-1.75H8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3.15" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </span>
            </div>

            <div className={styles.heroCopy}>
              <h1>{accountDisplayName}</h1>
              <p>{profile?.email || "Loading email"}</p>
              <small>
                {accountTypeLabel} account&nbsp; • &nbsp;{memberSinceLabel}
              </small>
            </div>
          </div>

          <div className={styles.heroStatusGroup}>
            <span className={styles.statusBadge}>Active</span>
            {isDealerAccount && !isMiddlemanAccount ? (
              <span className={`${styles.statusBadge} ${styles.directoryHeroBadge}`}>
                Directory {directoryStatusLabel.toLowerCase()}
              </span>
            ) : null}
          </div>
        </section>

        {notice ? (
          <div
            className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}
            role={notice.tone === "error" ? "alert" : "status"}
            aria-live={notice.tone === "error" ? "assertive" : "polite"}
            aria-atomic="true"
          >
            <span>{notice.message}</span>
            {notice.tone === "error" ? (
              <button
                type="button"
                className={styles.noticeDismissButton}
                onClick={() => setNotice(null)}
                aria-label="Dismiss account message"
              >
                ×
              </button>
            ) : null}
          </div>
        ) : null}

        <section className={styles.accountDashboard}>
          <section className={`${styles.card} ${styles.overviewCard}`}>
            <div className={styles.compactCardHeader}>
              <h2>Account overview</h2>
              <p>Your account at a glance</p>
            </div>

            <div className={styles.metricGrid}>
              <div className={styles.metricTile}>
                <span>Account type</span>
                <strong>{accountTypeLabel}</strong>
              </div>

              <div className={styles.metricTile}>
                <span>Contact number</span>
                <strong>{profileDraft.phone.trim() || "Not saved"}</strong>
              </div>

              <div className={styles.metricTile}>
                <span>Profile progress</span>
                <strong>
                  {completedFields}/{PROFILE_COMPLETION_TOTAL}
                </strong>
                <small>{completionPercentage}% complete</small>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-label="Profile completion"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={completionPercentage}
                  aria-valuetext={`${completionPercentage}% complete`}
                >
                  <span style={{ width: `${completionPercentage}%` }} />
                </div>
              </div>

              <div className={styles.metricTile}>
                <span>
                  {isOwnerAccount ? "QR PIN status" : "Directory status"}
                </span>
                <strong>
                  {isOwnerAccount ? scanPinDisplayLabel : directoryStatusLabel}
                </strong>
              </div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.quickActionsCard}`}>
            <div className={styles.compactCardHeader}>
              <h2>Quick actions</h2>
              <p>Frequently used actions</p>
            </div>

            <div className={styles.quickActionGroups}>
              <section
                className={styles.quickActionGroup}
                aria-labelledby="account-assets-actions-title"
              >
                <div className={styles.quickActionGroupHeader}>
                  <h3 id="account-assets-actions-title">Account &amp; assets</h3>
                </div>

                <div className={styles.quickActionList}>
                  {isOwnerAccount || isDealerAccount ? <button type="button" className={styles.quickActionButton} onClick={() => openActionModal("notifications")}>
                    <QuickActionIcon name="notifications" />
                    <strong>Notifications</strong>
                  </button> : null}
                  <button
                    type="button"
                    className={styles.quickActionButton}
                    onClick={openBusinessEditor}
                  >
                    <QuickActionIcon name="business" />
                    <strong>Edit business details</strong>
                  </button>

                  {isAssetRegisterAccount ? (
                    <button
                      type="button"
                      className={styles.quickActionButton}
                      onClick={openAssetRegistersPage}
                    >
                      <QuickActionIcon name="registers" />
                      <strong>Manage asset registers</strong>
                    </button>
                  ) : null}

                  {isAssetRegisterAccount ? (
                    <button
                      type="button"
                      className={styles.quickActionButton}
                      onClick={openAssetTransfersPage}
                    >
                      <QuickActionIcon name="claim" />
                      <strong>Claim or send an asset</strong>
                    </button>
                  ) : null}

                  {showScanPinControls ? (
                    <button
                      type="button"
                      className={styles.quickActionButton}
                      onClick={openScanPinEditor}
                    >
                      <QuickActionIcon name="pin" />
                      <strong>Update QR PIN</strong>
                    </button>
                  ) : null}
                </div>
              </section>

              <section
                className={styles.quickActionGroup}
                aria-labelledby="apps-visibility-actions-title"
              >
                <div className={styles.quickActionGroupHeader}>
                  <h3 id="apps-visibility-actions-title">Apps &amp; visibility</h3>
                </div>

                <div className={styles.quickActionList}>
                  {isOwnerAccount ? (
                    <button
                      type="button"
                      className={styles.quickActionButton}
                      onClick={openFieldManagerPage}
                      aria-label="Manage Field Manager access"
                    >
                      <QuickActionIcon name="fieldManager" />
                      <strong>Field Manager access</strong>
                    </button>
                  ) : null}

                  {isOwnerAccount ? (
                    <button
                      type="button"
                      className={styles.quickActionButton}
                      onClick={openOwnerAppAccessPage}
                      aria-label="Manage Owner App access"
                    >
                      <QuickActionIcon name="ownerApp" />
                      <strong>Owner App access</strong>
                    </button>
                  ) : null}

                  {isDealerAccount ? (
                    <button
                      type="button"
                      className={styles.quickActionButton}
                      onClick={openDealerAppAccessPage}
                    >
                      <QuickActionIcon name="dealer" />
                      <strong>{isMiddlemanAccount ? "Middleman app access" : "Manage Dealer App staff"}</strong>
                    </button>
                  ) : null}

                  {showMarketplaceContact ? (
                    <button
                      type="button"
                      className={styles.quickActionButton}
                      onClick={openMarketplaceEditor}
                      aria-label="Marketplace contact details"
                    >
                      <QuickActionIcon name="marketplace" />
                      <strong>Marketplace contact</strong>
                    </button>
                  ) : null}

                  {isOwnerAccount ? (
                    <Link href="/my-showroom" className={styles.quickActionButton}>
                      <QuickActionIcon name="showroom" />
                      <strong>Manage my showroom</strong>
                    </Link>
                  ) : null}

                  {isOwnerAccount ? (
                    <button
                      type="button"
                      className={styles.quickActionButton}
                      onClick={openDiscoveryEditor}
                    >
                      <QuickActionIcon name="discovery" />
                      <strong>Discovery settings</strong>
                    </button>
                  ) : null}

                  {showPartnerDirectory ? (
                    <button
                      type="button"
                      className={styles.quickActionButton}
                      onClick={openPartnerDirectory}
                    >
                      <QuickActionIcon name="directory" />
                      <strong>Partner directory</strong>
                    </button>
                  ) : null}
                </div>
              </section>
            </div>
          </section>

          <section
            className={`${styles.card} ${styles.securityCard}`}
            aria-labelledby="password-security-title"
          >
            <div className={styles.compactCardHeader}>
              <h2 id="password-security-title">Password & security</h2>
              <p>Secure your sign-in and recovery options.</p>
            </div>

            <div className={styles.securityActionsGrid}>
              <button
                type="button"
                className={styles.securityActionCard}
                onClick={openPasswordEditor}
              >
                <QuickActionIcon name="security" />
                <span className={styles.securityActionCopy}>
                  <strong>Change password</strong>
                </span>
              </button>

              <button
                type="button"
                className={styles.securityActionCard}
                onClick={handleSendSelfResetEmail}
                disabled={isSendingResetEmail || !profile?.email}
              >
                <QuickActionIcon name="reset" />
                <span className={styles.securityActionCopy}>
                  <strong>
                    {isSendingResetEmail ? "Sending reset link..." : "Email a reset link"}
                  </strong>
                </span>
              </button>
            </div>
          </section>
        </section>

        <section
          className={`${styles.card} ${styles.accountDeleteCard} ${styles.dangerZone}`}
          aria-labelledby="danger-zone-title"
        >
          <div className={styles.dangerZoneCopy}>
            <h2 id="danger-zone-title">Delete account</h2>
            <p>
              Permanently delete your account and saved workspace.
            </p>
          </div>

          <button
            type="button"
            className={`${styles.dangerButton} ${styles.dangerZoneButton}`}
            onClick={openDeleteDialog}
          >
            <span className={styles.dangerZoneButtonIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5.5 7.5h13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                <path d="M9.25 7.5V5.25h5.5V7.5" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                <path d="m7.2 7.5.7 11.25h8.2l.7-11.25" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                <path d="M10.1 11v4.3M13.9 11v4.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </span>
            <span>Delete account</span>
          </button>
        </section>
      </section>

      {activeAccountModal === "password" ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCardNarrow} ${styles.accountScrollableModalCard} ${styles.passwordModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-modal-title"
            aria-describedby="change-password-modal-description"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="change-password-modal-title">Change password</h2>
                <p id="change-password-modal-description">
                  Use your current password to protect your Aim4price account.
                </p>
                <button
                  type="button"
                  className={styles.modalCloseButton}
                  onClick={closeActionModal}
                  aria-label="Close password editor"
                  disabled={isChangingPassword}
                >
                  ×
                </button>
              </div>

              <div className={styles.passwordModalIntro}>
                <QuickActionIcon name="security" />
                <div>
                  <strong>Secure every signed-in device</strong>
                  <p>Updating your password signs out your other active sessions.</p>
                </div>
              </div>

              {passwordModalNotice ? (
                <div
                  className={`${styles.modalInlineNotice} ${passwordModalNotice.tone === "error" ? styles.modalInlineNoticeError : styles.modalInlineNoticeSuccess}`}
                  role={passwordModalNotice.tone === "error" ? "alert" : "status"}
                  aria-live={passwordModalNotice.tone === "error" ? "assertive" : "polite"}
                  aria-atomic="true"
                >
                  {passwordModalNotice.message}
                </div>
              ) : null}

              <form
                className={`${styles.modalForm} ${styles.passwordModalForm}`}
                onSubmit={handlePasswordChangeSubmit}
                noValidate
              >
                <label className={styles.modalField}>
                  <span>Current password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    autoFocus
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value);
                      setPasswordModalNotice(null);
                    }}
                    placeholder="Enter current password"
                  />
                </label>

                <label className={styles.modalField}>
                  <span>New password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setPasswordModalNotice(null);
                    }}
                    placeholder="Minimum 8 characters"
                    aria-describedby="password-requirements"
                  />
                  <small id="password-requirements" className={styles.securityFieldHint}>
                    Use at least 8 characters and avoid reusing an old password.
                  </small>
                </label>

                <label className={styles.modalField}>
                  <span>Confirm new password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirmNewPassword}
                    onChange={(event) => {
                      setConfirmNewPassword(event.target.value);
                      setPasswordModalNotice(null);
                    }}
                    placeholder="Repeat new password"
                    aria-invalid={!passwordsMatch}
                    aria-describedby={!passwordsMatch ? "password-match-error" : undefined}
                  />
                  {!passwordsMatch ? (
                    <small
                      id="password-match-error"
                      className={styles.securityFieldError}
                      role="alert"
                    >
                      The new passwords do not match.
                    </small>
                  ) : null}
                </label>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={closeActionModal}
                    disabled={isChangingPassword}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={!canSubmitPasswordChange}
                  >
                    {isChangingPassword ? "Updating password..." : "Update password"}
                  </button>
                </div>
              </form>
            </AccountModalScroller>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "business" ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountScrollableModalCard} ${styles.businessDetailsModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="business-details-modal-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="business-details-modal-title">Business details</h2>
                <p>
                  Complete one short section at a time. Your changes are saved
                  together on the final step.
                </p>
                <button type="button" className={styles.modalCloseButton} onClick={closeActionModal} aria-label="Close business details">×</button>
              </div>

              <ModalInlineNotice notice={actionModalNotice} />

              <ModalStepProgress
                currentStep={businessDetailsStep}
                labels={["Contact info", "Business address", "Business logo"]}
              />

              {isLoading ? (
                <p className={styles.loading}>Loading account details...</p>
              ) : (
                <form
                  className={`${styles.form} ${styles.compactEditForm} ${styles.wizardForm}`}
                  onSubmit={handleBusinessDetailsSubmit}
                >
                  {businessDetailsStep === 1 ? (
                    <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                      <div className={styles.modalSectionHeading}>
                        <strong>Contact information</strong>
                        <p>How Aim4price and customers identify and contact this business.</p>
                      </div>

                      <div className={styles.wizardFieldGrid}>
                        <label className={styles.field}>
                          <span>Full name</span>
                          <input value={profileDraft.displayName} onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="Full name" autoFocus />
                        </label>
                        <label className={styles.field}>
                          <span>Account email</span>
                          <input value={profile?.email ?? ""} disabled />
                          <small className={styles.fieldHint}>Used only for login and account access.</small>
                        </label>
                        <label className={styles.field}>
                          <span>Business name</span>
                          <input value={profileDraft.businessName} onChange={(event) => setProfileDraft((current) => ({ ...current, businessName: event.target.value }))} placeholder="Business name" />
                        </label>
                        <label className={styles.field}>
                          <span>Business email</span>
                          <input type="email" value={profileDraft.marketplaceEmail} onChange={(event) => setProfileDraft((current) => ({ ...current, marketplaceEmail: event.target.value }))} placeholder="business@email.co.za" />
                        </label>
                        <label className={styles.field}>
                          <span>Contact details</span>
                          <input value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone, WhatsApp or office number" />
                        </label>
                        {isPartnerAccount ? (
                          <label className={styles.field}>
                            <span>Website link</span>
                            <input inputMode="url" value={profileDraft.websiteUrl} onChange={(event) => setProfileDraft((current) => ({ ...current, websiteUrl: event.target.value }))} placeholder="https://your-business.co.za" />
                          </label>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  {businessDetailsStep === 2 ? (
                    <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                      <div className={styles.modalSectionHeading}>
                        <strong>Business address</strong>
                        <p>Your main business location. The public directory map pin is controlled separately.</p>
                      </div>

                      <div className={styles.wizardFieldGrid}>
                        <label className={styles.field}>
                          <span>Account type</span>
                          <div className={styles.readOnlyValue}>{accountTypeLabel}</div>
                          <small className={styles.fieldHint}>Account type is locked after signup.</small>
                        </label>
                        <label className={styles.field}>
                          <span>Province</span>
                          <input value={profileDraft.province} onChange={(event) => setProfileDraft((current) => ({ ...current, province: event.target.value }))} placeholder="Province" autoFocus />
                        </label>
                        <label className={styles.field}>
                          <span>Town / city</span>
                          <input value={profileDraft.townCity} onChange={(event) => setProfileDraft((current) => ({ ...current, townCity: event.target.value }))} placeholder="Town or city" />
                        </label>
                        <label className={styles.field}>
                          <span>Address line 1</span>
                          <input value={profileDraft.addressLine1} onChange={(event) => setProfileDraft((current) => ({ ...current, addressLine1: event.target.value }))} placeholder="Street address" />
                        </label>
                        <label className={`${styles.field} ${styles.fullWidth}`}>
                          <span>Address line 2</span>
                          <input value={profileDraft.addressLine2} onChange={(event) => setProfileDraft((current) => ({ ...current, addressLine2: event.target.value }))} placeholder="Building, unit or area (optional)" />
                        </label>
                      </div>
                    </section>
                  ) : null}

                  {businessDetailsStep === 3 ? (
                    <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                      <div className={styles.modalSectionHeading}>
                        <strong>Business logo</strong>
                        <p>Add one clear logo, or keep the initials shown as your fallback.</p>
                      </div>

                      <div className={styles.mediaUploadField}>
                        <div className={styles.businessMediaEditorGrid}>
                          <section className={styles.businessLogoPanel}>
                            <div className={styles.businessLogoPreview}>
                              {logoUrl ? <img src={logoUrl} alt="Business logo preview" /> : <span>{profileInitials}</span>}
                            </div>
                            <div className={styles.businessLogoCopy}>
                              <strong>{logoUrl ? "Logo ready to save" : "No logo uploaded yet"}</strong>
                              <p>JPG, PNG or WEBP. Maximum {formatUploadSize(MAX_LOGO_UPLOAD_BYTES)}.</p>
                              <div className={styles.businessMediaControls}>
                                <label className={styles.uploadButton}>
                                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoFileChange} disabled={isReadingLogo || isSavingProfile} />
                                  {isReadingLogo ? "Reading logo..." : logoUrl ? "Replace logo" : "Upload logo"}
                                </label>
                                {logoUrl ? <button type="button" className={styles.ghostButton} onClick={handleRemoveLogo} disabled={isSavingProfile || isReadingLogo}>Remove logo</button> : null}
                              </div>
                            </div>
                          </section>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  <div className={`${styles.actionsRow} ${styles.wizardActions}`}>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={closeActionModal}
                      disabled={isSavingProfile || isReadingLogo}
                    >
                      Cancel
                    </button>
                    {businessDetailsStep > 1 ? (
                      <button type="button" className={styles.secondaryButton} onClick={() => setBusinessDetailsStep((businessDetailsStep - 1) as BusinessDetailsStep)} disabled={isSavingProfile || isReadingLogo}>Back</button>
                    ) : null}
                    <button type="submit" className={styles.primaryButton} disabled={isSavingProfile || isReadingLogo}>
                      {businessDetailsStep === 3 ? (isSavingProfile ? "Saving..." : "Save business details") : "Next"}
                    </button>
                  </div>
                </form>
              )}
            </AccountModalScroller>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "scanPin" ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountActionModalCardNarrow} ${styles.accountScrollableModalCard} ${styles.scanPinModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-pin-modal-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="scan-pin-modal-title">Update QR PIN</h2>
                <p>
                  Create or update the 4 to 8 digit PIN used for QR scan updates.
                </p>
                <button type="button" className={styles.modalCloseButton} onClick={closeActionModal} aria-label="Close QR PIN editor">×</button>
              </div>

              <ModalInlineNotice notice={actionModalNotice} />

            <div className={styles.pinModalStatus}>
              <span>Current PIN status</span>
              <strong>{scanPinDisplayLabel}</strong>
              <p>
                {scanPinStatus.hasPin
                  ? "A PIN is already saved for QR scan access."
                  : "No PIN is saved yet."}
              </p>
            </div>

              <form className={styles.modalForm} onSubmit={handleScanPinSubmit}>
              <div className={styles.pinGrid}>
                <label className={styles.field}>
                  <span>New scan PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={scanPinDraft}
                    onChange={(event) =>
                      setScanPinDraft(normalizePinInput(event.target.value))
                    }
                    placeholder="4 to 8 digits"
                  />
                </label>

                <label className={styles.field}>
                  <span>Confirm scan PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={scanPinConfirmDraft}
                    onChange={(event) =>
                      setScanPinConfirmDraft(
                        normalizePinInput(event.target.value),
                      )
                    }
                    placeholder="Repeat PIN"
                  />
                </label>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={closeActionModal}
                  disabled={isSavingScanPin || isDisablingScanPin}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleDisableScanPin}
                  disabled={
                    isDisablingScanPin ||
                    isSavingScanPin ||
                    isLoadingScanPin ||
                    !scanPinStatus.hasPin
                  }
                >
                  {isDisablingScanPin ? "Disabling..." : "Disable PIN"}
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={
                    isSavingScanPin || isDisablingScanPin || isLoadingScanPin
                  }
                >
                  {isSavingScanPin
                    ? "Saving..."
                    : scanPinStatus.hasPin
                      ? "Update PIN"
                      : "Save PIN"}
                </button>
              </div>
              </form>
            </AccountModalScroller>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "notifications" ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountScrollableModalCard} ${styles.marketplaceModalCard} ${styles.notificationModalCard}`}
            role="dialog" aria-modal="true" aria-labelledby="notifications-modal-title" tabIndex={-1}
            onClick={(event) => event.stopPropagation()}>
            <div className={styles.accountModalScrollContent}>
              <div className={styles.modalHeader}>
                <h2 id="notifications-modal-title">Notifications</h2>
                <p>Choose the phone alerts for your account.</p>
                <button type="button" className={styles.modalCloseButton} disabled={isSavingNotifications}
                  onClick={closeActionModal} aria-label="Close notification settings">×</button>
              </div>
              <DesktopNotificationSettings onClose={closeActionModal}
                onBusyChange={(busy) => { activeActionModalBusyRef.current = busy; setIsSavingNotifications(busy); }}
                onSaved={() => { closeActionModal(); setNotice({tone:'success',message:'Notification settings saved.'}); }} />
            </div>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "marketplace" ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountScrollableModalCard} ${styles.marketplaceModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-contact-modal-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="marketplace-contact-modal-title">Marketplace contact</h2>
                <p>
                  These details are shown when customers contact you from the
                  marketplace.
                </p>
                <button type="button" className={styles.modalCloseButton} onClick={closeActionModal} aria-label="Close marketplace contact editor">×</button>
              </div>

              <ModalInlineNotice notice={actionModalNotice} />

              {isLoading ? (
              <p className={styles.loading}>Loading marketplace contact...</p>
            ) : (
              <form
                className={`${styles.marketplaceFields} ${styles.compactEditForm}`}
                onSubmit={handleProfileSubmit}
              >
                <label className={styles.field}>
                  <span>Seller name</span>
                  <input
                    value={profileDraft.marketplaceSellerName}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        marketplaceSellerName: event.target.value,
                      }))
                    }
                    placeholder={marketplaceSellerName}
                  />
                </label>

                <label className={styles.field}>
                  <span>Contact details</span>
                  <input
                    type="text"
                    value={profileDraft.marketplacePhone}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        marketplacePhone: event.target.value,
                      }))
                    }
                    placeholder={marketplacePhone}
                  />
                </label>

                <label className={styles.field}>
                  <span>Business email</span>
                  <input
                    type="email"
                    value={profileDraft.marketplaceEmail}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        marketplaceEmail: event.target.value,
                      }))
                    }
                    placeholder="business@email.co.za"
                  />
                </label>

                <label className={styles.field}>
                  <span>Location</span>
                  <input
                    value={profileDraft.marketplaceLocation}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        marketplaceLocation: event.target.value,
                      }))
                    }
                    placeholder={marketplaceLocation}
                  />
                </label>

                <div className={styles.marketplaceActions}>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={closeActionModal}
                    disabled={isSavingProfile || isReadingLogo}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={isSavingProfile || isReadingLogo}
                  >
                    {isSavingProfile ? "Saving..." : "Save marketplace"}
                  </button>
                </div>
              </form>
              )}
            </AccountModalScroller>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "discovery" && isOwnerAccount ? (
        <div
          className={styles.modalBackdrop} data-website-overlay
          onClick={closeActionModal}
        >
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountScrollableModalCard} ${styles.discoveryModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discovery-participation-modal-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="discovery-participation-modal-title">
                  Discovery participation
                </h2>
                <p>
                  Choose whether your eligible assets may participate while you
                  browse other participating owners&apos; assets.
                </p>
                <button
                  type="button"
                  className={styles.modalCloseButton}
                  onClick={closeActionModal}
                  aria-label="Close Discovery participation"
                >
                  ×
                </button>
              </div>

              <ModalInlineNotice notice={actionModalNotice} />

              <form className={`${styles.modalForm} ${styles.compactEditForm}`} onSubmit={handleProfileSubmit}>
                <label
                  className={styles.toggleField}
                >
                  <input
                    type="checkbox"
                    checked={profileDraft.discoveryParticipationEnabled}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        discoveryParticipationEnabled: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>Participate in Discovery</strong>
                    <small>
                      When enabled, all eligible Aim4price assets participate.
                      Your own assets remain hidden from you.
                    </small>
                  </span>
                </label>

                <div className={styles.confirmBox}>
                  <strong>Private information stays locked.</strong>
                  <p>
                    Photos and contact details are released only after you
                    approve an enquiry. Turning this off immediately removes
                    your assets and revokes Discovery-only access.
                  </p>
                </div>

                <div className={styles.marketplaceActions}>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={closeActionModal}
                    disabled={isSavingProfile}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? "Saving..." : "Save participation"}
                  </button>
                </div>
              </form>
            </AccountModalScroller>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "partnerDirectory" && showPartnerDirectory ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountScrollableModalCard} ${styles.partnerDirectoryModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-directory-modal-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="partner-directory-modal-title">Partner directory</h2>
                <p>
                  Choose your visibility, place your map pin, then add the
                  details owners will see.
                </p>
                <button type="button" className={styles.modalCloseButton} onClick={closeActionModal} aria-label="Close partner directory editor">×</button>
              </div>

              <ModalInlineNotice notice={actionModalNotice} />

              <ModalStepProgress
                currentStep={partnerDirectoryStep}
                labels={["Visibility", "Map", "Additional info"]}
              />

              <form
                className={`${styles.form} ${styles.directoryForm} ${styles.wizardForm}`}
                onSubmit={handlePartnerDirectorySubmit}
              >
                {partnerDirectoryStep === 1 ? (
                  <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                    <div className={styles.modalSectionHeading}>
                      <strong>Directory visibility</strong>
                      <p>You are always in control of whether owners can find and select this business.</p>
                    </div>

                    <div className={styles.partnerDecisionGrid}>
                      <label className={`${styles.toggleField} ${styles.partnerVisibilityToggle}`}>
                        <input type="checkbox" checked={profileDraft.partnerDirectoryEnabled} onChange={(event) => setProfileDraft((current) => ({ ...current, partnerDirectoryEnabled: event.target.checked }))} />
                        <span>
                          <strong>{profileDraft.partnerDirectoryEnabled ? "Visible in the partner directory" : "Hidden from the partner directory"}</strong>
                          <small>{profileDraft.partnerDirectoryEnabled ? "Owners can find this business and send it quote leads." : "Owners cannot select this business until visibility is turned on."}</small>
                        </span>
                      </label>

                      <aside className={`${styles.partnerDirectoryPreview} ${!profileDraft.partnerDirectoryEnabled ? styles.partnerPreviewDisabled : ""}`} aria-label="Partner directory owner preview">
                        <span className={styles.partnerPreviewEyebrow}>{profileDraft.partnerDirectoryEnabled ? "Owner preview" : "Preview hidden"}</span>
                        <div className={styles.partnerPreviewIdentity}>
                          <div className={styles.partnerPreviewLogo}>{logoUrl ? <img src={logoUrl} alt="" /> : <strong>{profileInitials}</strong>}</div>
                          <div><strong>{accountDisplayName}</strong><small>{marketplaceLocation}</small></div>
                        </div>
                        <p>{profileDraft.partnerDirectoryEnabled ? "This is the business identity owners will see." : "Turn visibility on when you are ready to receive quote leads."}</p>
                      </aside>
                    </div>
                  </section>
                ) : null}

                {partnerDirectoryStep === 2 ? (
                  <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                    <div className={`${styles.partnerMapField} ${styles.fullWidth}`}>
                      <div className={styles.partnerMapHeader}>
                        <div>
                          <span>Partner map pin</span>
                          <strong>Set your public map pin</strong>
                          <p>Click the map, drag the pin, or use your current location. A precise street address is not displayed.</p>
                        </div>
                        <div className={styles.partnerMapActions}>
                          <button type="button" className={styles.secondaryButton} onClick={handleUseCurrentLocation}>Use current location</button>
                          {partnerDirectoryPin ? <button type="button" className={styles.ghostButton} onClick={clearPartnerMapPin}>Clear pin</button> : null}
                        </div>
                      </div>
                      <div ref={partnerMapElementRef} className={styles.partnerMapCanvas} aria-label="Partner directory map pin" />
                      <div className={styles.partnerMapFooter}>
                        <span>{partnerDirectoryPinLabel}</span>
                        <strong>{partnerDirectoryPin ? "Pin selected" : "Click the map to place your pin"}</strong>
                      </div>
                    </div>
                  </section>
                ) : null}

                {partnerDirectoryStep === 3 ? (
                  <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                    <div className={styles.modalSectionHeading}>
                      <strong>Additional information</strong>
                      <p>Help owners understand where you work and what your business offers.</p>
                    </div>

                    <div className={styles.partnerAdditionalGrid}>
                      <div className={styles.wizardFieldGrid}>
                        <label className={styles.field}>
                          <span>Service radius km</span>
                          <input inputMode="numeric" value={profileDraft.partnerServiceRadiusKm} onChange={(event) => setProfileDraft((current) => ({ ...current, partnerServiceRadiusKm: event.target.value }))} placeholder="250" autoFocus />
                        </label>
                        <label className={styles.field}>
                          <span>Brand focus</span>
                          <input value={profileDraft.partnerBrandFocus} onChange={(event) => setProfileDraft((current) => ({ ...current, partnerBrandFocus: event.target.value }))} placeholder="John Deere, Case IH, New Holland" />
                        </label>
                        <label className={`${styles.field} ${styles.fullWidth}`}>
                          <span>Services</span>
                          <input value={profileDraft.partnerServices} onChange={(event) => setProfileDraft((current) => ({ ...current, partnerServices: event.target.value }))} placeholder="Finance, insurance, replacements, trade-ins" />
                        </label>
                        <label className={`${styles.field} ${styles.fullWidth} ${styles.partnerDescriptionField}`}>
                          <span>Partner description</span>
                          <textarea value={profileDraft.partnerDescription} onChange={(event) => setProfileDraft((current) => ({ ...current, partnerDescription: event.target.value }))} placeholder="Briefly explain how your business helps agricultural asset owners." />
                          <small className={styles.partnerDescriptionCount}>{profileDraft.partnerDescription.trim().length} characters</small>
                        </label>
                      </div>

                      <aside className={styles.partnerDirectoryPreview} aria-label="Completed owner preview">
                        <span className={styles.partnerPreviewEyebrow}>Owner preview</span>
                        <div className={styles.partnerPreviewIdentity}>
                          <div className={styles.partnerPreviewLogo}>{logoUrl ? <img src={logoUrl} alt="" /> : <strong>{profileInitials}</strong>}</div>
                          <div><strong>{accountDisplayName}</strong><small>{marketplaceLocation}</small></div>
                        </div>
                        <div className={styles.partnerPreviewDetails}>
                          <span>{profileDraft.partnerBrandFocus.trim() || "All supported brands"}</span>
                          <span>{profileDraft.partnerServices.trim() || "Services not added yet"}</span>
                        </div>
                        <p>{profileDraft.partnerDescription.trim() || "Add a short description so owners understand how your business can help them."}</p>
                      </aside>
                    </div>
                  </section>
                ) : null}

                <div className={`${styles.actionsRow} ${styles.wizardActions}`}>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={closeActionModal}
                    disabled={isSavingProfile || isReadingLogo}
                  >
                    Cancel
                  </button>
                  {partnerDirectoryStep > 1 ? (
                    <button type="button" className={styles.secondaryButton} onClick={() => goToPartnerDirectoryStep((partnerDirectoryStep - 1) as PartnerDirectoryStep)} disabled={isSavingProfile}>Back</button>
                  ) : null}
                  <button type="submit" className={styles.primaryButton} disabled={isSavingProfile}>
                    {partnerDirectoryStep === 3 ? (isSavingProfile ? "Saving..." : "Save directory") : "Next"}
                  </button>
                </div>
              </form>
            </AccountModalScroller>
          </section>
        </div>
      ) : null}

      {isDeleteDialogOpen ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeDeleteDialog}>
          <section
            ref={deleteDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCardNarrow} ${styles.accountScrollableModalCard} ${styles.deleteAccountModalCard}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-modal-title"
            aria-describedby="delete-account-modal-description"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="delete-account-modal-title">Confirm permanent removal</h2>
                <p id="delete-account-modal-description">
                  This removes your full Aim4price workspace, including saved
                  valuations, asset register items and account details.
                </p>
                <button
                  type="button"
                  className={styles.modalCloseButton}
                  onClick={closeDeleteDialog}
                  aria-label="Close account deletion"
                  disabled={isDeletingAccount}
                >
                  ×
                </button>
              </div>

              {deleteModalError ? (
                <div
                  className={`${styles.modalInlineNotice} ${styles.modalInlineNoticeError}`}
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  {deleteModalError}
                </div>
              ) : null}

              <form className={styles.modalForm} onSubmit={handleDeleteAccount}>
              <div className={styles.confirmBox}>
                <strong>This action cannot be undone.</strong>
                <p>Enter your password and type DELETE below to confirm.</p>
              </div>

              <label className={styles.modalField}>
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  disabled={isDeletingAccount}
                  onChange={(event) => {
                    setDeletePassword(event.target.value);
                    setDeleteModalError(null);
                  }}
                  placeholder="Enter your password"
                />
              </label>

              <label className={styles.modalField}>
                <span>Type DELETE to confirm</span>
                <input
                  value={deleteConfirmText}
                  disabled={isDeletingAccount}
                  onChange={(event) => {
                    setDeleteConfirmText(event.target.value);
                    setDeleteModalError(null);
                  }}
                  placeholder="DELETE"
                />
              </label>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={closeDeleteDialog}
                  disabled={isDeletingAccount}
                  autoFocus
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.dangerButton}
                  disabled={isDeletingAccount}
                >
                  {isDeletingAccount ? "Deleting account..." : "Delete account"}
                </button>
              </div>
              </form>
            </AccountModalScroller>
          </section>
        </div>
      ) : null}
    </main>
  );
}
