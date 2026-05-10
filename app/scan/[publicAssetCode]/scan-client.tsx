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
type EditorKey = "usage" | "fuel" | "notes" | "service" | "photos";
type LocationState = "idle" | "capturing" | "ready" | "error";
type ScanAssetUsageMode = "hours" | "percent" | "km" | "none";

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
  serviceNote: string;
  latitude: string;
  longitude: string;
  photoUrls: string[];
};

const initialDraft: DraftState = {
  hours: "",
  lifeWorkedPercent: "",
  fuelPercent: "",
  note: "",
  serviceNote: "",
  latitude: "",
  longitude: "",
  photoUrls: [],
};

const QUICK_FUEL_OPTIONS = [25, 50, 75, 100] as const;

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

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

function hasMeaningfulDraftValue(draft: DraftState): boolean {
  return Boolean(
    draft.hours.trim() !== "" ||
    draft.lifeWorkedPercent.trim() !== "" ||
    draft.fuelPercent.trim() !== "" ||
    draft.note.trim() ||
    draft.serviceNote.trim() ||
    draft.photoUrls.length,
  );
}

function hasLocationCaptured(draft: DraftState): boolean {
  return Boolean(draft.latitude.trim() && draft.longitude.trim());
}

function formatCoordinate(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(6) : value;
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
  if (asset.usageMode === "percent") return "Lifetime worked %";
  if (asset.usageMode === "km") return "Odometer";
  if (asset.usageMode === "hours") return "Hour meter";
  return "Usage";
}

function usageModalLabel(asset: ScanSafeAsset): string {
  if (asset.usageMode === "percent") return "Lifetime worked percentage";
  if (asset.usageMode === "km") return "Odometer reading";
  return "Hour meter reading";
}

function usagePlaceholder(asset: ScanSafeAsset): string {
  if (asset.usageMode === "percent")
    return asset.lifeWorkedPercent !== null
      ? String(asset.lifeWorkedPercent)
      : "Enter % worked";
  if (asset.usageMode === "km")
    return asset.hours !== null
      ? String(asset.hours)
      : "Enter current kilometres";
  return asset.hours !== null ? String(asset.hours) : "Enter current hours";
}

function assetPlaceholderLabel(asset: ScanSafeAsset): string {
  const label = asset.equipmentFamilyLabel || asset.kind || "Asset";
  return label.replace(/[_-]+/g, " ").trim() || "Asset";
}

function buildEditorSummary(
  editor: EditorKey,
  draft: DraftState,
  asset: ScanSafeAsset | null,
  isUploading = false,
): string {
  if (editor === "usage") {
    if (asset?.usageMode === "percent") {
      return draft.lifeWorkedPercent.trim() !== ""
        ? `${draft.lifeWorkedPercent}% worked ready to save`
        : asset.lifeWorkedPercent !== null
          ? `${formatPercent(asset.lifeWorkedPercent)} worked saved now`
          : "Tap to capture lifetime worked %";
    }

    if (asset?.usageMode === "km") {
      return draft.hours.trim() !== ""
        ? `${new Intl.NumberFormat("en-ZA").format(Number(draft.hours))} km ready to save`
        : asset.hours !== null
          ? `${formatNumber(asset.hours)} km saved now`
          : "Tap to capture kilometres";
    }

    return draft.hours.trim() !== ""
      ? `${new Intl.NumberFormat("en-ZA").format(Number(draft.hours))} hours ready to save`
      : asset?.hours !== null && typeof asset?.hours !== "undefined"
        ? `${formatNumber(asset.hours)} hours saved now`
        : "Tap to capture the hour meter";
  }

  if (editor === "fuel") {
    return draft.fuelPercent.trim() !== ""
      ? `${draft.fuelPercent}% ready to save`
      : asset?.fuelPercent !== null && typeof asset?.fuelPercent !== "undefined"
        ? `${formatFuel(asset.fuelPercent)} saved now`
        : "Tap to capture the fuel level";
  }

  if (editor === "service") {
    return draft.serviceNote.trim()
      ? "Service / check note ready"
      : "Tap when the asset was serviced or checked";
  }

  if (editor === "notes") {
    return draft.note.trim()
      ? `${draft.note.trim().length} characters ready`
      : asset?.note
        ? "Asset already has notes saved"
        : "Tap to add a short note";
  }

  if (isUploading) {
    return "Uploading photos…";
  }

  if (draft.photoUrls.length) {
    return `${draft.photoUrls.length} new photo${draft.photoUrls.length === 1 ? "" : "s"} ready`;
  }

  if (asset?.photos.length) {
    return `${asset.photos.length} photo${asset.photos.length === 1 ? "" : "s"} already saved`;
  }

  return "Tap to add fresh photos";
}

type IconProps = { className?: string };

function MeterIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 16a8 8 0 1 1 16 0" />
      <path d="M12 13l4-4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function FuelIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 4h10v16H5z" />
      <path d="M15 8h2.5l1.5 2v6a2 2 0 0 1-2 2h-2" />
      <path d="M8 8h4" />
    </svg>
  );
}

function NotesIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
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
      className={className}
      aria-hidden="true"
    >
      <path d="m14.7 6.3 3 3" />
      <path d="M9 18.5 4.5 14l2.1-2.1L9 14.3 17.4 6l2.1 2.1z" />
      <path d="M4 21h16" />
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
      className={className}
      aria-hidden="true"
    >
      <path d="M4 7h3l2-2h6l2 2h3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
      <circle cx="12" cy="13" r="4" />
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
      className={className}
      aria-hidden="true"
    >
      <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
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
      className={className}
      aria-hidden="true"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function getModalCopy(
  editor: EditorKey | null,
  asset: ScanSafeAsset | null,
): { eyebrow: string; title: string; description: string } {
  if (editor === "usage") {
    if (asset?.usageMode === "percent") {
      return {
        eyebrow: "Lifetime worked",
        title: "Update the worked percentage",
        description: "Enter the current percentage worked.",
      };
    }

    if (asset?.usageMode === "km") {
      return {
        eyebrow: "Odometer",
        title: "Capture the latest kilometres",
        description: "Enter the current odometer reading.",
      };
    }

    return {
      eyebrow: "Hour meter",
      title: "Capture the latest hours",
      description: "Enter the current hour-meter reading.",
    };
  }

  if (editor === "fuel") {
    return {
      eyebrow: "Fuel",
      title: "Capture the tank level",
      description: "Choose the fuel level right now.",
    };
  }

  if (editor === "service") {
    return {
      eyebrow: "Serviced / checked",
      title: "Add a service or check note",
      description: "Write what was serviced, checked or repaired.",
    };
  }

  if (editor === "notes") {
    return {
      eyebrow: "Notes",
      title: "Add a short operational note",
      description: "Add a short note for the owner or manager.",
    };
  }

  return {
    eyebrow: "Photos",
    title: "Add fresh photos",
    description: "Add clear photos of the asset or issue.",
  };
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
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState<{
    tone: NoticeTone;
    message: string;
  } | null>(null);
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [isLoadingAsset, setIsLoadingAsset] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [locationMessage, setLocationMessage] = useState(
    "Location will be captured automatically once the asset is unlocked.",
  );
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [activeEditor, setActiveEditor] = useState<EditorKey | null>(null);
  const [showLocationReminder, setShowLocationReminder] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [savedUpdateCount, setSavedUpdateCount] = useState(0);
  const autoLocationKeyRef = useRef<string>("");

  useEffect(() => {
    setAsset(null);
    setDraft(initialDraft);
    setPin("");
    setIsUnavailable(false);
    setIsSubmittingPin(false);
    setIsLoadingAsset(false);
    setIsSaving(false);
    setIsUploading(false);
    setActiveEditor(null);
    setShowLocationReminder(false);
    setIsDone(false);
    setSavedUpdateCount(0);
    setLocationState("idle");
    setLocationMessage(
      "Location will be captured automatically once the asset is unlocked.",
    );
    autoLocationKeyRef.current = "";
  }, [normalizedCode]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3800);
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
      const data = (await response
        .json()
        .catch(() => null)) as ScanAssetResponse | null;

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
      setDraft(initialDraft);
      setIsDone(false);
      setSavedUpdateCount(0);
      setShowLocationReminder(true);
      setLocationState("idle");
      setLocationMessage("Capturing GPS automatically…");
    } finally {
      setIsLoadingAsset(false);
    }
  }

  async function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pin.length < 4) {
      setNotice({ tone: "error", message: "Enter the farm scan PIN." });
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
      const data = (await response
        .json()
        .catch(() => null)) as ScanAuthResponse | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? "Incorrect scan PIN.");
      }

      setPin("");
      await loadUnlockedAsset();
      setNotice({ tone: "success", message: "Asset unlocked." });
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
    const files = Array.from(event.target.files ?? []) as File[];
    if (!files.length) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set("publicAssetCode", normalizedCode);
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/scan/uploads", {
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

      setDraft((current) => ({
        ...current,
        photoUrls: Array.from(
          new Set([
            ...current.photoUrls,
            ...data.uploads!.map((entry) => entry.url),
          ]),
        ).slice(0, 12),
      }));
      setNotice({
        tone: "success",
        message: `${data.uploads.length} photo${data.uploads.length === 1 ? "" : "s"} added.`,
      });
      setActiveEditor("photos");
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

  function handleRemovePhoto(url: string) {
    setDraft((current) => ({
      ...current,
      photoUrls: current.photoUrls.filter((entry) => entry !== url),
    }));
  }

  function keepCurrentLocation(current: DraftState): DraftState {
    return {
      ...initialDraft,
      latitude: current.latitude,
      longitude: current.longitude,
    };
  }

  function openEditor(nextEditor: EditorKey) {
    setDraft((current) => {
      const nextDraft = keepCurrentLocation(current);

      if (!asset) {
        return nextDraft;
      }

      if (nextEditor === "usage") {
        if (asset.usageMode === "percent" && asset.lifeWorkedPercent !== null) {
          return {
            ...nextDraft,
            lifeWorkedPercent: String(asset.lifeWorkedPercent),
          };
        }

        if (
          (asset.usageMode === "hours" || asset.usageMode === "km") &&
          asset.hours !== null
        ) {
          return { ...nextDraft, hours: String(Math.round(asset.hours)) };
        }
      }

      if (nextEditor === "fuel" && asset.fuelPercent !== null) {
        return {
          ...nextDraft,
          fuelPercent: String(Math.round(asset.fuelPercent)),
        };
      }

      return nextDraft;
    });

    setActiveEditor(nextEditor);
  }

  function closeEditor() {
    setDraft((current) => keepCurrentLocation(current));
    setActiveEditor(null);
  }

  async function captureLocation(isAutomatic = false) {
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
      isAutomatic
        ? "Capturing the asset location automatically…"
        : "Capturing your current location…",
    );

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = String(position.coords.latitude);
          const longitude = String(position.coords.longitude);
          setDraft((current) => ({
            ...current,
            latitude,
            longitude,
          }));
          setLocationState("ready");
          setLocationMessage("GPS is ready for this update.");
          if (!isAutomatic) {
            setNotice({ tone: "success", message: "Location captured." });
          }
          resolve();
        },
        (error) => {
          setLocationState("error");
          setLocationMessage(
            error.message ||
              "Location is required before this QR update can be saved.",
          );
          if (!isAutomatic) {
            setNotice({
              tone: "error",
              message: error.message || "Failed to capture location.",
            });
          }
          resolve();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }

  function buildSaveNote(): string {
    const parts: string[] = [];
    const serviceNote = draft.serviceNote.trim();
    const normalNote = draft.note.trim();

    if (serviceNote) {
      parts.push(`Serviced/Checked: ${serviceNote}`);
    }

    if (normalNote) {
      parts.push(normalNote);
    }

    return parts.join("\n\n");
  }

  async function handleSaveUpdate() {
    if (!asset) return;

    if (!hasMeaningfulDraftValue(draft)) {
      setNotice({
        tone: "error",
        message:
          "Tap one of the update blocks and add something before saving.",
      });
      return;
    }

    if (!hasLocationCaptured(draft)) {
      setNotice({
        tone: "error",
        message:
          "Location is required for every QR update. Allow GPS and try again.",
      });
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
            hours:
              asset.usageMode === "hours" || asset.usageMode === "km"
                ? draft.hours
                : "",
            lifeWorkedPercent:
              asset.usageMode === "percent" ? draft.lifeWorkedPercent : "",
            fuelPercent: asset.canUpdateFuel ? draft.fuelPercent : "",
            note: buildSaveNote(),
            photoUrls: draft.photoUrls,
            latitude: draft.latitude,
            longitude: draft.longitude,
          }),
        },
      );
      const data = (await response
        .json()
        .catch(() => null)) as SaveScanEventResponse | null;

      if (!response.ok || !data?.ok || !data.asset) {
        throw new Error(data?.error ?? "Failed to save the QR update.");
      }

      setAsset(data.asset);
      setSavedUpdateCount((current) => current + 1);
      setDraft(initialDraft);
      setActiveEditor(null);
      setNotice({ tone: "success", message: "QR update saved." });
      setLocationState("idle");
      setLocationMessage("Capturing GPS again…");
      void captureLocation(true);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save the QR update.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleDone() {
    setActiveEditor(null);
    setShowLocationReminder(false);
    setIsDone(true);
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);
  }

  const locationReady = hasLocationCaptured(draft);
  const canSave = locationReady && hasMeaningfulDraftValue(draft) && !isSaving;
  const modalCopy = getModalCopy(activeEditor, asset);
  const showUsageAction = asset ? asset.usageMode !== "none" : false;
  const showFuelAction = Boolean(asset?.canUpdateFuel);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {!asset && !isUnavailable ? (
          <section className={styles.scanIntroCard}>
            <span className={styles.kicker}>Aim4price QR update</span>
            <h1>Asset update</h1>
            <p>Enter the farm PIN. Then update only what changed.</p>
            <div
              className={styles.scanIntroPills}
              aria-label="Available QR updates"
            >
              <span>Hour meter</span>
              <span>Fuel</span>
              <span>Service</span>
              <span>Notes</span>
              <span>Photos</span>
            </div>
          </section>
        ) : null}

        {asset && !isDone ? (
          <section className={styles.scanAssetHeader}>
            <span className={styles.kicker}>Asset opened</span>
            <h1>{asset.title}</h1>
            <p>
              {asset.serialNumber
                ? `Serial ${asset.serialNumber}`
                : asset.equipmentFamilyLabel ||
                  asset.plateLabel ||
                  "Ready to update"}
            </p>

            <div className={styles.scanStatusGrid}>
              <div>
                <span>{usageTitle(asset)}</span>
                <strong>{formatUsage(asset)}</strong>
              </div>
              {asset.canUpdateFuel ? (
                <div>
                  <span>Fuel</span>
                  <strong>{formatFuel(asset.fuelPercent)}</strong>
                </div>
              ) : null}
              <div>
                <span>GPS</span>
                <strong>
                  {locationReady
                    ? "Ready"
                    : locationState === "capturing"
                      ? "Capturing"
                      : "Required"}
                </strong>
              </div>
            </div>
          </section>
        ) : null}

        {asset && isDone ? (
          <section className={styles.doneCard}>
            <span className={styles.kicker}>Updated asset</span>
            <h1>Asset update complete</h1>
            <p>
              {savedUpdateCount > 0
                ? `${savedUpdateCount} update${savedUpdateCount === 1 ? "" : "s"} saved with GPS.`
                : "You can now close this page."}
            </p>
            <div className={styles.doneAssetBox}>
              <span>{asset.title}</span>
              <strong>{asset.plateLabel || asset.publicAssetCode}</strong>
            </div>
          </section>
        ) : null}

        {notice ? (
          <div
            className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}
          >
            {notice.message}
          </div>
        ) : null}

        {!asset && !isUnavailable ? (
          <section className={styles.pinCard}>
            <div className={styles.pinCardCopy}>
              <span className={styles.kicker}>Farm PIN required</span>
              <h2>Enter farm PIN</h2>
              <p>This protects the owner’s asset history.</p>
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
                  disabled={isSubmittingPin || isLoadingAsset}
                />
              </label>

              <div className={styles.pinActions}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isSubmittingPin || isLoadingAsset || pin.length < 4}
                >
                  {isSubmittingPin || isLoadingAsset
                    ? "Opening…"
                    : "Unlock asset"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {isUnavailable ? (
          <section className={styles.unavailableCard}>
            <span className={styles.kicker}>Unavailable</span>
            <h2>This asset could not be opened</h2>
            <p>
              Check the QR code, or ask the owner to confirm that the farm scan
              PIN is enabled for this account.
            </p>
          </section>
        ) : null}

        {asset && !isDone ? (
          <>
            <section className={styles.quickPanel}>
              <div className={styles.quickPanelHeader}>
                <h2>What do you want to update?</h2>
                <button
                  type="button"
                  className={`${styles.gpsStatusButton} ${locationReady ? styles.gpsStatusButtonReady : ""}`}
                  onClick={() => void captureLocation(false)}
                  disabled={locationState === "capturing" || isSaving}
                >
                  {locationReady
                    ? "GPS ready"
                    : locationState === "capturing"
                      ? "GPS…"
                      : "GPS required"}
                </button>
              </div>

              <div className={styles.quickActionGrid}>
                {showUsageAction ? (
                  <button
                    type="button"
                    className={styles.quickActionCard}
                    onClick={() => openEditor("usage")}
                  >
                    <div className={styles.quickActionIconWrap}>
                      <MeterIcon className={styles.quickActionIcon} />
                    </div>
                    <div className={styles.quickActionCopy}>
                      <strong>{usageTitle(asset)}</strong>
                      <span>{buildEditorSummary("usage", draft, asset)}</span>
                    </div>
                    <ChevronRightIcon className={styles.quickActionChevron} />
                  </button>
                ) : null}

                {showFuelAction ? (
                  <button
                    type="button"
                    className={styles.quickActionCard}
                    onClick={() => openEditor("fuel")}
                  >
                    <div className={styles.quickActionIconWrap}>
                      <FuelIcon className={styles.quickActionIcon} />
                    </div>
                    <div className={styles.quickActionCopy}>
                      <strong>Fuel</strong>
                      <span>{buildEditorSummary("fuel", draft, asset)}</span>
                    </div>
                    <ChevronRightIcon className={styles.quickActionChevron} />
                  </button>
                ) : null}

                <button
                  type="button"
                  className={styles.quickActionCard}
                  onClick={() => openEditor("service")}
                >
                  <div className={styles.quickActionIconWrap}>
                    <ServiceIcon className={styles.quickActionIcon} />
                  </div>
                  <div className={styles.quickActionCopy}>
                    <strong>Service</strong>
                    <span>{buildEditorSummary("service", draft, asset)}</span>
                  </div>
                  <ChevronRightIcon className={styles.quickActionChevron} />
                </button>

                <button
                  type="button"
                  className={styles.quickActionCard}
                  onClick={() => openEditor("notes")}
                >
                  <div className={styles.quickActionIconWrap}>
                    <NotesIcon className={styles.quickActionIcon} />
                  </div>
                  <div className={styles.quickActionCopy}>
                    <strong>Notes</strong>
                    <span>{buildEditorSummary("notes", draft, asset)}</span>
                  </div>
                  <ChevronRightIcon className={styles.quickActionChevron} />
                </button>

                <button
                  type="button"
                  className={styles.quickActionCard}
                  onClick={() => openEditor("photos")}
                >
                  <div className={styles.quickActionIconWrap}>
                    <CameraIcon className={styles.quickActionIcon} />
                  </div>
                  <div className={styles.quickActionCopy}>
                    <strong>Photos</strong>
                    <span>
                      {buildEditorSummary("photos", draft, asset, isUploading)}
                    </span>
                  </div>
                  <ChevronRightIcon className={styles.quickActionChevron} />
                </button>
              </div>
            </section>

            <section className={styles.doneActionBar}>
              <div>
                <strong>
                  {savedUpdateCount > 0
                    ? `${savedUpdateCount} saved`
                    : "Finish scan"}
                </strong>
                <span>
                  {savedUpdateCount > 0
                    ? "Tap Done when you are finished."
                    : "Save any update first if needed."}
                </span>
              </div>
              <button
                type="button"
                className={styles.doneButton}
                onClick={handleDone}
                disabled={isSaving || isUploading}
              >
                Done
              </button>
            </section>
          </>
        ) : null}
      </div>

      {asset && showLocationReminder && !activeEditor && !isDone ? (
        <div className={styles.modalOverlay}>
          <div
            className={styles.modalBackdrop}
            onClick={() => setShowLocationReminder(false)}
          />

          <div
            className={`${styles.modalCard} ${styles.locationReminderModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-reminder-title"
          >
            <div className={styles.locationReminderIcon}>
              <LocationIcon className={styles.buttonIcon} />
            </div>
            <h3 id="location-reminder-title">Keep location on</h3>
            <p>
              Every QR save stores a GPS point automatically. Allow location
              access on this phone before saving updates.
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

      {asset && activeEditor ? (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBackdrop} onClick={closeEditor} />

          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-editor-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>{modalCopy.eyebrow}</span>
                <h3 id="scan-editor-title">{modalCopy.title}</h3>
                <p>{modalCopy.description}</p>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={closeEditor}
                aria-label="Close editor"
              >
                <CloseIcon className={styles.buttonIcon} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {activeEditor === "usage" && asset.usageMode !== "none" ? (
                <label className={styles.field}>
                  <span>{usageModalLabel(asset)}</span>
                  <input
                    inputMode="numeric"
                    placeholder={usagePlaceholder(asset)}
                    value={
                      asset.usageMode === "percent"
                        ? draft.lifeWorkedPercent
                        : draft.hours
                    }
                    onChange={(event) =>
                      setDraft((current) =>
                        asset.usageMode === "percent"
                          ? {
                              ...current,
                              lifeWorkedPercent: normalizePercentInput(
                                event.target.value,
                              ),
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
                  <p className={styles.helperText}>
                    {asset.usageMode === "percent"
                      ? "Only percentage worked is tracked for this asset."
                      : "Use the latest reading shown on the machine."}
                  </p>
                </label>
              ) : null}

              {activeEditor === "fuel" ? (
                <div className={styles.modalStack}>
                  <div className={styles.fuelReadout}>
                    {draft.fuelPercent ||
                      (asset.fuelPercent !== null
                        ? String(asset.fuelPercent)
                        : "0")}
                    %
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    className={styles.rangeInput}
                    value={
                      draft.fuelPercent ||
                      (asset.fuelPercent !== null
                        ? String(asset.fuelPercent)
                        : "0")
                    }
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        fuelPercent: normalizeIntegerInput(
                          event.target.value,
                        ).slice(0, 3),
                      }))
                    }
                    disabled={isSaving}
                  />
                  <div className={styles.quickOptionRow}>
                    {QUICK_FUEL_OPTIONS.map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={`${styles.quickOptionButton} ${draft.fuelPercent === String(option) ? styles.quickOptionButtonActive : ""}`}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            fuelPercent: String(option),
                          }))
                        }
                        disabled={isSaving}
                      >
                        {option}%
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeEditor === "service" ? (
                <label className={styles.field}>
                  <span>Service / check note</span>
                  <textarea
                    placeholder="Example: Checked oil and filters, greased boom, no leaks found…"
                    value={draft.serviceNote}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        serviceNote: event.target.value.slice(0, 1600),
                      }))
                    }
                    disabled={isSaving}
                  />
                </label>
              ) : null}

              {activeEditor === "notes" ? (
                <label className={styles.field}>
                  <span>Short note</span>
                  <textarea
                    placeholder="Moved to north field, delivered, washed, minor issue noticed…"
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
              ) : null}

              {activeEditor === "photos" ? (
                <div className={styles.modalStack}>
                  <div className={styles.uploadRow}>
                    <label className={styles.uploadButton}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handleUploadChange}
                        disabled={isUploading || isSaving}
                      />
                      {isUploading ? "Uploading…" : "Add photos"}
                    </label>
                    <p className={styles.helperText}>
                      Use clear light and make the asset easy to identify.
                    </p>
                  </div>

                  {draft.photoUrls.length ? (
                    <div className={styles.photoGrid}>
                      {draft.photoUrls.map((url, index) => (
                        <article
                          key={`${url}-${index}`}
                          className={styles.photoCard}
                        >
                          <img
                            src={url}
                            alt={`Scan upload ${index + 1}`}
                            className={styles.photoImage}
                          />
                          <button
                            type="button"
                            className={styles.removePhotoButton}
                            onClick={() => handleRemovePhoto(url)}
                          >
                            Remove
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.helperText}>
                      No new photos added for this update yet.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeEditor}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={!canSave || isUploading}
                onClick={() => void handleSaveUpdate()}
              >
                {isSaving ? "Saving…" : "Save update"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
