export const QR_SCAN_SESSION_STORAGE_PREFIX = "aim4price_qr_scan_session_v1:";

type LocationSessionInput = {
  publicAssetCode: string;
  assetId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAtIso: string;
};

function normalizePublicAssetCode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function saveFieldManagerServiceLocation(input: LocationSessionInput): boolean {
  if (typeof window === "undefined") return false;

  const publicAssetCode = normalizePublicAssetCode(input.publicAssetCode);
  if (!publicAssetCode) return false;

  const storageKey = `${QR_SCAN_SESSION_STORAGE_PREFIX}${publicAssetCode}`;
  let current: Record<string, unknown> = {};

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed)) current = parsed;
    }

    const nextSession = {
      ...current,
      publicAssetCode,
      assetId: input.assetId.trim(),
      latitude: String(input.latitude),
      longitude: String(input.longitude),
      gpsAccuracyMeters:
        input.accuracyMeters !== null ? String(input.accuracyMeters) : "",
      locationMessage: "Location ready for this service.",
      locationCapturedAtIso: input.capturedAtIso,
      updatedAtIso: new Date().toISOString(),
    };

    window.sessionStorage.setItem(storageKey, JSON.stringify(nextSession));
    return true;
  } catch {
    return false;
  }
}
