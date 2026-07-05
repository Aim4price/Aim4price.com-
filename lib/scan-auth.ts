import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "./auth-session";
import { safeAssetOwnerError } from "./asset-owner-resolver";
import {
  getScanAssetAccessContext,
  normalizePublicAssetCode,
  type ScanAccessMode,
  type ScanAssetAccessContext,
  type ScanSafeAsset,
} from "./scan-assets";
import { getDb } from "./db";
import { getActiveFieldManagerScanSessionFromRequest } from "./field-manager-session";
import { verifyScanPin } from "./scan-pin";

export const SCAN_SESSION_COOKIE_NAME = "aim4price_scan";
export const SCAN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const FIELD_MANAGER_OPEN_ERROR =
  "Could not open this asset. Your Field Manager session may not have access to this asset. Please go back and try again.";

type ScanSessionClaims = {
  ownerUserId: string;
  publicAssetCode: string;
  pinUpdatedAtMs: number;
  issuedAtMs: number;
  expiresAtMs: number;
};

export type AuthorizedScanAccess = {
  ok: true;
  accessMode: ScanAccessMode;
  asset: ScanSafeAsset;
  ownerUserId: string;
  fieldManagerId?: string;
  fieldManagerDisplayName?: string;
  fieldManagerSessionId?: string;
};

export type UnauthorizedScanAccess = {
  ok: false;
  status: number;
  error: string;
  pinRequired: boolean;
};

type AuthorizeScanAccessOptions = {
  fieldManagerHint?: boolean;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getScanCookieSecret(): string {
  return (
    process.env.SCAN_COOKIE_SECRET ||
    process.env.BETTER_AUTH_SECRET ||
    "aim4price-development-scan-secret"
  );
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64");
}

function signPayload(payloadBase64Url: string): string {
  return toBase64Url(
    createHmac("sha256", getScanCookieSecret())
      .update(payloadBase64Url)
      .digest(),
  );
}

function buildScanSessionToken(claims: ScanSessionClaims): string {
  const payloadBase64Url = toBase64Url(JSON.stringify(claims));
  const signature = signPayload(payloadBase64Url);
  return `${payloadBase64Url}.${signature}`;
}

function readScanSessionToken(token: string): ScanSessionClaims | null {
  const [payloadSegment, signatureSegment] = String(token ?? "").split(".");

  if (!payloadSegment || !signatureSegment) {
    return null;
  }

  const expectedSignature = signPayload(payloadSegment);
  const received = Buffer.from(signatureSegment);
  const expected = Buffer.from(expectedSignature);

  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      fromBase64Url(payloadSegment).toString("utf8"),
    ) as Partial<ScanSessionClaims>;
    const ownerUserId = asText(parsed.ownerUserId);
    const publicAssetCode = normalizePublicAssetCode(parsed.publicAssetCode);
    const pinUpdatedAtMs = Number(parsed.pinUpdatedAtMs);
    const issuedAtMs = Number(parsed.issuedAtMs);
    const expiresAtMs = Number(parsed.expiresAtMs);

    if (
      !ownerUserId ||
      !publicAssetCode ||
      !Number.isFinite(pinUpdatedAtMs) ||
      !Number.isFinite(issuedAtMs) ||
      !Number.isFinite(expiresAtMs)
    ) {
      return null;
    }

    return {
      ownerUserId,
      publicAssetCode,
      pinUpdatedAtMs,
      issuedAtMs,
      expiresAtMs,
    };
  } catch {
    return null;
  }
}

function parseScanPinUpdatedAtMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function applyScanSessionCookie(
  response: NextResponse,
  claims: {
    ownerUserId: string;
    publicAssetCode: string;
    pinUpdatedAtIso: string;
  },
): void {
  const now = Date.now();
  const token = buildScanSessionToken({
    ownerUserId: claims.ownerUserId,
    publicAssetCode: normalizePublicAssetCode(claims.publicAssetCode),
    pinUpdatedAtMs: parseScanPinUpdatedAtMs(claims.pinUpdatedAtIso) ?? now,
    issuedAtMs: now,
    expiresAtMs: now + SCAN_SESSION_MAX_AGE_SECONDS * 1000,
  });

  response.cookies.set({
    name: SCAN_SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SCAN_SESSION_MAX_AGE_SECONDS,
  });
}

export function clearScanSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SCAN_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function getScanSessionFromRequest(
  request: NextRequest,
  expectedPublicAssetCode?: string,
): ScanSessionClaims | null {
  const rawCookie = request.cookies.get(SCAN_SESSION_COOKIE_NAME)?.value;
  const claims = rawCookie ? readScanSessionToken(rawCookie) : null;

  if (!claims) {
    return null;
  }

  if (expectedPublicAssetCode) {
    const normalizedExpectedCode = normalizePublicAssetCode(
      expectedPublicAssetCode,
    );
    if (
      !normalizedExpectedCode ||
      claims.publicAssetCode !== normalizedExpectedCode
    ) {
      return null;
    }
  }

  if (claims.expiresAtMs <= Date.now()) {
    return null;
  }

  return claims;
}

function safeScanContextError(error: unknown): UnauthorizedScanAccess | null {
  const safe = safeAssetOwnerError(error, "Could not open this asset safely.");
  if (!safe) return null;
  return {
    ok: false,
    status: safe.status,
    error: safe.error,
    pinRequired: false,
  };
}

export async function verifyScanPinForAsset(
  publicAssetCode: string,
  pin: string,
): Promise<
  | {
      ok: true;
      asset: ScanSafeAsset;
      ownerUserId: string;
      pinUpdatedAtIso: string;
    }
  | UnauthorizedScanAccess
> {
  let context: ScanAssetAccessContext | null;

  try {
    context = await getScanAssetAccessContext(publicAssetCode);
  } catch (error) {
    return (
      safeScanContextError(error) ?? {
        ok: false,
        status: 500,
        error: "Failed to open this asset safely.",
        pinRequired: false,
      }
    );
  }

  if (!context || !context.asset.id) {
    return {
      ok: false,
      status: 404,
      error: "Asset not found.",
      pinRequired: false,
    };
  }

  if (context.asset.qrStatus === "deleted") {
    return {
      ok: false,
      status: 404,
      error: "This asset QR code is inactive.",
      pinRequired: false,
    };
  }

  if (
    !context.scanPinEnabled ||
    !context.scanPinHash ||
    !context.scanPinUpdatedAtIso
  ) {
    return {
      ok: false,
      status: 403,
      error: "Scan PIN access is not enabled for this account yet.",
      pinRequired: false,
    };
  }

  let isValidPin = false;
  try {
    isValidPin = await verifyScanPin(pin, context.scanPinHash);
  } catch (error) {
    return {
      ok: false,
      status: 401,
      error:
        error instanceof Error && error.message.trim()
          ? error.message
          : "Incorrect scan PIN.",
      pinRequired: true,
    };
  }

  if (!isValidPin) {
    return {
      ok: false,
      status: 401,
      error: "Incorrect scan PIN.",
      pinRequired: true,
    };
  }

  return {
    ok: true,
    asset: context.asset,
    ownerUserId: context.asset.userId,
    pinUpdatedAtIso: context.scanPinUpdatedAtIso,
  };
}

export async function authorizeScanAccess(
  request: NextRequest,
  publicAssetCode: string,
  options: AuthorizeScanAccessOptions = {},
): Promise<AuthorizedScanAccess | UnauthorizedScanAccess> {
  const normalizedCode = normalizePublicAssetCode(publicAssetCode);

  if (!normalizedCode) {
    return {
      ok: false,
      status: 404,
      error: "Asset not found.",
      pinRequired: false,
    };
  }

  const fieldManagerScanSession =
    await getActiveFieldManagerScanSessionFromRequest(request, normalizedCode);

  if (fieldManagerScanSession) {
    try {
      const context = await getScanAssetAccessContext(normalizedCode, {
        assetId: fieldManagerScanSession.assetId ?? null,
        expectedOwnerUserId: fieldManagerScanSession.ownerUserId,
      });

      if (!context || !context.asset.id) {
        return {
          ok: false,
          status: 404,
          error: "Asset not found.",
          pinRequired: false,
        };
      }

      if (context.asset.qrStatus === "deleted") {
        return {
          ok: false,
          status: 404,
          error: "This asset QR code is inactive.",
          pinRequired: false,
        };
      }

      if (fieldManagerScanSession.ownerUserId !== context.asset.userId) {
        console.error("[scan-auth] Field Manager scan session owner mismatch", {
          publicAssetCode: normalizedCode,
          assetId: context.asset.id,
          resolvedAssetOwnerId: context.asset.userId,
          fieldManagerOwnerId: fieldManagerScanSession.ownerUserId,
          fieldManagerId: fieldManagerScanSession.managerId,
          route: "authorize-scan-access",
        });
        return {
          ok: false,
          status: 403,
          error: FIELD_MANAGER_OPEN_ERROR,
          pinRequired: false,
        };
      }

      return {
        ok: true,
        accessMode: "field_manager",
        asset: context.asset,
        ownerUserId: context.asset.userId,
        fieldManagerId: fieldManagerScanSession.managerId,
        fieldManagerDisplayName: fieldManagerScanSession.displayName,
        fieldManagerSessionId: fieldManagerScanSession.scanSessionId,
      };
    } catch (error) {
      const safe = safeAssetOwnerError(error, FIELD_MANAGER_OPEN_ERROR);
      return {
        ok: false,
        status: safe?.status ?? 403,
        error: safe?.error ?? FIELD_MANAGER_OPEN_ERROR,
        pinRequired: false,
      };
    }
  }

  if (options.fieldManagerHint) {
    return {
      ok: false,
      status: 401,
      error: FIELD_MANAGER_OPEN_ERROR,
      pinRequired: false,
    };
  }

  let context: ScanAssetAccessContext | null;

  try {
    context = await getScanAssetAccessContext(normalizedCode);
  } catch (error) {
    return (
      safeScanContextError(error) ?? {
        ok: false,
        status: 500,
        error: "Failed to open this asset safely.",
        pinRequired: false,
      }
    );
  }

  if (!context || !context.asset.id) {
    return {
      ok: false,
      status: 404,
      error: "Asset not found.",
      pinRequired: false,
    };
  }

  if (context.asset.qrStatus === "deleted") {
    return {
      ok: false,
      status: 404,
      error: "This asset QR code is inactive.",
      pinRequired: false,
    };
  }

  const claims = getScanSessionFromRequest(request, normalizedCode);

  if (!claims) {
    return {
      ok: false,
      status: context.scanPinEnabled ? 401 : 403,
      error: context.scanPinEnabled
        ? "Enter the farm scan PIN to open this asset."
        : "Scan PIN access is not enabled for this account yet.",
      pinRequired: context.scanPinEnabled,
    };
  }

  const currentPinUpdatedAtMs = parseScanPinUpdatedAtMs(
    context.scanPinUpdatedAtIso,
  );

  if (
    claims.ownerUserId !== context.asset.userId ||
    claims.publicAssetCode !== normalizedCode ||
    !context.scanPinEnabled ||
    !context.scanPinHash ||
    currentPinUpdatedAtMs === null ||
    claims.pinUpdatedAtMs !== currentPinUpdatedAtMs
  ) {
    return {
      ok: false,
      status: 401,
      error: "Your scan access session has expired. Enter the PIN again.",
      pinRequired: true,
    };
  }

  return {
    ok: true,
    accessMode: "scan_pin",
    asset: context.asset,
    ownerUserId: context.asset.userId,
  };
}

export async function authorizeScanUpload(
  request: NextRequest,
  publicAssetCode: string,
): Promise<AuthorizedScanAccess | UnauthorizedScanAccess> {
  return authorizeScanAccess(request, publicAssetCode);
}

export async function hasOwnerOrValidScanSession(
  request: NextRequest,
): Promise<boolean> {
  const session = await getServerSession();

  if (session?.user?.id) {
    return true;
  }

  const fieldManagerScanSession =
    await getActiveFieldManagerScanSessionFromRequest(request);

  if (fieldManagerScanSession) {
    return true;
  }

  const claims = getScanSessionFromRequest(request);

  if (!claims) {
    return false;
  }

  const db = getDb();
  const result = await db.query<{
    scan_pin_hash: string | null;
    scan_pin_enabled: boolean | null;
    scan_pin_updated_at: string | null;
  }>(
    `
      select
        scan_pin_hash,
        scan_pin_enabled,
        scan_pin_updated_at
      from account_profiles
      where user_id = $1
      limit 1
    `,
    [claims.ownerUserId],
  );

  const row = result.rows[0];
  const currentPinUpdatedAtMs = parseScanPinUpdatedAtMs(
    row?.scan_pin_updated_at ?? null,
  );

  return Boolean(
    row &&
    claims.publicAssetCode &&
    row.scan_pin_enabled &&
    asText(row.scan_pin_hash) &&
    currentPinUpdatedAtMs !== null &&
    currentPinUpdatedAtMs === claims.pinUpdatedAtMs &&
    claims.expiresAtMs > Date.now(),
  );
}
