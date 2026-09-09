import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import {
  getFieldManagerById,
  validateFieldManagerFuelStorage,
  validateFieldManagerScanAsset,
  type FieldManagerRecord,
} from "./field-manager";
import { normalizePublicAssetCode } from "./scan-assets";

export const FIELD_MANAGER_SESSION_COOKIE_NAME = "aim4price_field_manager";
export const FIELD_MANAGER_SCAN_COOKIE_NAME = "aim4price_field_manager_scan";
export const FIELD_MANAGER_FUEL_SCAN_COOKIE_NAME =
  "aim4price_field_manager_fuel_scan";
export const FIELD_MANAGER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
export const FIELD_MANAGER_SCAN_MAX_AGE_SECONDS = 60 * 45;

type FieldManagerSessionClaims = {
  managerId: string;
  ownerUserId: string;
  username: string;
  displayName: string;
  sessionVersion: number;
  sessionId: string;
  issuedAtMs: number;
  expiresAtMs: number;
};

type FieldManagerScanClaims = {
  managerId: string;
  ownerUserId: string;
  displayName: string;
  publicAssetCode: string;
  assetId?: string;
  scanSessionId: string;
  issuedAtMs: number;
  expiresAtMs: number;
};

type FieldManagerFuelScanClaims = {
  managerId: string;
  ownerUserId: string;
  displayName: string;
  publicFuelStorageCode: string;
  fuelScanSessionId: string;
  issuedAtMs: number;
  expiresAtMs: number;
};

export type ActiveFieldManagerSession = {
  managerId: string;
  ownerUserId: string;
  username: string;
  displayName: string;
  sessionVersion: number;
  sessionId: string;
  expiresAtMs: number;
};

export type ActiveFieldManagerScanSession = {
  managerId: string;
  ownerUserId: string;
  displayName: string;
  publicAssetCode: string;
  assetId?: string;
  scanSessionId: string;
  expiresAtMs: number;
};

export type ActiveFieldManagerFuelScanSession = {
  managerId: string;
  ownerUserId: string;
  displayName: string;
  publicFuelStorageCode: string;
  fuelScanSessionId: string;
  expiresAtMs: number;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePublicFuelStorageCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function getFieldManagerCookieSecret(): string {
  const configured = (
    process.env.FIELD_MANAGER_COOKIE_SECRET ||
    process.env.SCAN_COOKIE_SECRET ||
    process.env.BETTER_AUTH_SECRET
  );
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error('Field Manager session secret is not configured.');
  return "aim4price-development-field-manager-secret";
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
    createHmac("sha256", getFieldManagerCookieSecret())
      .update(payloadBase64Url)
      .digest(),
  );
}

function buildToken(
  claims:
    | FieldManagerSessionClaims
    | FieldManagerScanClaims
    | FieldManagerFuelScanClaims,
): string {
  const payloadBase64Url = toBase64Url(JSON.stringify(claims));
  return `${payloadBase64Url}.${signPayload(payloadBase64Url)}`;
}

function readTokenPayload(token: string): Record<string, unknown> | null {
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
    ) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readSessionClaims(token: string): FieldManagerSessionClaims | null {
  const parsed = readTokenPayload(token);
  if (!parsed) return null;

  const managerId = asText(parsed.managerId);
  const ownerUserId = asText(parsed.ownerUserId);
  const username = asText(parsed.username);
  const displayName = asText(parsed.displayName);
  const sessionVersion = Number(parsed.sessionVersion);
  const sessionId = asText(parsed.sessionId);
  const issuedAtMs = Number(parsed.issuedAtMs);
  const expiresAtMs = Number(parsed.expiresAtMs);

  if (!managerId || !ownerUserId || !username || !displayName || !sessionId) {
    return null;
  }

  if (!Number.isFinite(sessionVersion) || sessionVersion < 1 || !Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
    return null;
  }

  return {
    managerId,
    ownerUserId,
    username,
    displayName,
    sessionVersion: Math.round(sessionVersion),
    sessionId,
    issuedAtMs,
    expiresAtMs,
  };
}

function readScanClaims(token: string): FieldManagerScanClaims | null {
  const parsed = readTokenPayload(token);
  if (!parsed) return null;

  const managerId = asText(parsed.managerId);
  const ownerUserId = asText(parsed.ownerUserId);
  const displayName = asText(parsed.displayName);
  const publicAssetCode = normalizePublicAssetCode(parsed.publicAssetCode);
  const assetId = asText(parsed.assetId);
  const scanSessionId = asText(parsed.scanSessionId);
  const issuedAtMs = Number(parsed.issuedAtMs);
  const expiresAtMs = Number(parsed.expiresAtMs);

  if (
    !managerId ||
    !ownerUserId ||
    !displayName ||
    !publicAssetCode ||
    !scanSessionId
  ) {
    return null;
  }

  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
    return null;
  }

  return {
    managerId,
    ownerUserId,
    displayName,
    publicAssetCode,
    assetId: assetId || undefined,
    scanSessionId,
    issuedAtMs,
    expiresAtMs,
  };
}

function readFuelScanClaims(token: string): FieldManagerFuelScanClaims | null {
  const parsed = readTokenPayload(token);
  if (!parsed) return null;

  const managerId = asText(parsed.managerId);
  const ownerUserId = asText(parsed.ownerUserId);
  const displayName = asText(parsed.displayName);
  const publicFuelStorageCode = normalizePublicFuelStorageCode(
    parsed.publicFuelStorageCode,
  );
  const fuelScanSessionId = asText(parsed.fuelScanSessionId);
  const issuedAtMs = Number(parsed.issuedAtMs);
  const expiresAtMs = Number(parsed.expiresAtMs);

  if (
    !managerId ||
    !ownerUserId ||
    !displayName ||
    !publicFuelStorageCode ||
    !fuelScanSessionId
  ) {
    return null;
  }

  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs)) {
    return null;
  }

  return {
    managerId,
    ownerUserId,
    displayName,
    publicFuelStorageCode,
    fuelScanSessionId,
    issuedAtMs,
    expiresAtMs,
  };
}

function sessionFromManager(
  manager: FieldManagerRecord,
  claims: FieldManagerSessionClaims,
): ActiveFieldManagerSession | null {
  if (!manager.isActive) return null;
  if (manager.ownerUserId !== claims.ownerUserId) return null;
  if (manager.sessionVersion !== claims.sessionVersion) return null;

  return {
    managerId: manager.id,
    ownerUserId: manager.ownerUserId,
    username: manager.username,
    displayName: manager.displayName,
    sessionVersion: manager.sessionVersion,
    sessionId: claims.sessionId,
    expiresAtMs: claims.expiresAtMs,
  };
}

export function applyFieldManagerSessionCookie(
  response: NextResponse,
  manager: FieldManagerRecord,
): ActiveFieldManagerSession {
  const now = Date.now();
  const claims: FieldManagerSessionClaims = {
    managerId: manager.id,
    ownerUserId: manager.ownerUserId,
    username: manager.username,
    displayName: manager.displayName,
    sessionVersion: manager.sessionVersion,
    sessionId: randomUUID(),
    issuedAtMs: now,
    expiresAtMs: now + FIELD_MANAGER_SESSION_MAX_AGE_SECONDS * 1000,
  };

  response.cookies.set({
    name: FIELD_MANAGER_SESSION_COOKIE_NAME,
    value: buildToken(claims),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: FIELD_MANAGER_SESSION_MAX_AGE_SECONDS,
  });

  return {
    managerId: claims.managerId,
    ownerUserId: claims.ownerUserId,
    username: claims.username,
    displayName: claims.displayName,
    sessionVersion: claims.sessionVersion,
    sessionId: claims.sessionId,
    expiresAtMs: claims.expiresAtMs,
  };
}

export function clearFieldManagerSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: FIELD_MANAGER_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function applyFieldManagerScanCookie(
  response: NextResponse,
  input: {
    managerId: string;
    ownerUserId: string;
    displayName: string;
    publicAssetCode: string;
    assetId?: string;
  },
): ActiveFieldManagerScanSession {
  const now = Date.now();
  const claims: FieldManagerScanClaims = {
    managerId: input.managerId,
    ownerUserId: input.ownerUserId,
    displayName: input.displayName,
    publicAssetCode: normalizePublicAssetCode(input.publicAssetCode),
    assetId: asText(input.assetId) || undefined,
    scanSessionId: randomUUID(),
    issuedAtMs: now,
    expiresAtMs: now + FIELD_MANAGER_SCAN_MAX_AGE_SECONDS * 1000,
  };

  response.cookies.set({
    name: FIELD_MANAGER_SCAN_COOKIE_NAME,
    value: buildToken(claims),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: FIELD_MANAGER_SCAN_MAX_AGE_SECONDS,
  });

  return {
    managerId: claims.managerId,
    ownerUserId: claims.ownerUserId,
    displayName: claims.displayName,
    publicAssetCode: claims.publicAssetCode,
    assetId: claims.assetId,
    scanSessionId: claims.scanSessionId,
    expiresAtMs: claims.expiresAtMs,
  };
}

export function clearFieldManagerScanCookie(response: NextResponse): void {
  response.cookies.set({
    name: FIELD_MANAGER_SCAN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function applyFieldManagerFuelScanCookie(
  response: NextResponse,
  input: {
    managerId: string;
    ownerUserId: string;
    displayName: string;
    publicFuelStorageCode: string;
  },
): ActiveFieldManagerFuelScanSession {
  const now = Date.now();
  const claims: FieldManagerFuelScanClaims = {
    managerId: input.managerId,
    ownerUserId: input.ownerUserId,
    displayName: input.displayName,
    publicFuelStorageCode: normalizePublicFuelStorageCode(
      input.publicFuelStorageCode,
    ),
    fuelScanSessionId: randomUUID(),
    issuedAtMs: now,
    expiresAtMs: now + FIELD_MANAGER_SCAN_MAX_AGE_SECONDS * 1000,
  };

  response.cookies.set({
    name: FIELD_MANAGER_FUEL_SCAN_COOKIE_NAME,
    value: buildToken(claims),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: FIELD_MANAGER_SCAN_MAX_AGE_SECONDS,
  });

  return {
    managerId: claims.managerId,
    ownerUserId: claims.ownerUserId,
    displayName: claims.displayName,
    publicFuelStorageCode: claims.publicFuelStorageCode,
    fuelScanSessionId: claims.fuelScanSessionId,
    expiresAtMs: claims.expiresAtMs,
  };
}

export function clearFieldManagerFuelScanCookie(response: NextResponse): void {
  response.cookies.set({
    name: FIELD_MANAGER_FUEL_SCAN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getActiveFieldManagerSessionFromRequest(
  request: NextRequest,
): Promise<ActiveFieldManagerSession | null> {
  const rawCookie = request.cookies.get(
    FIELD_MANAGER_SESSION_COOKIE_NAME,
  )?.value;
  const claims = rawCookie ? readSessionClaims(rawCookie) : null;

  if (!claims || claims.expiresAtMs <= Date.now()) {
    return null;
  }

  const manager = await getFieldManagerById(claims.managerId);

  if (!manager) {
    return null;
  }

  return sessionFromManager(manager, claims);
}

export async function requireActiveFieldManagerSession(
  request: NextRequest,
): Promise<
  | { ok: true; session: ActiveFieldManagerSession }
  | { ok: false; status: number; error: string }
> {
  const session = await getActiveFieldManagerSessionFromRequest(request);

  if (!session) {
    return {
      ok: false,
      status: 401,
      error: "Field Manager login is required.",
    };
  }

  return { ok: true, session };
}

export async function getActiveFieldManagerScanSessionFromRequest(
  request: NextRequest,
  expectedPublicAssetCode?: string,
): Promise<ActiveFieldManagerScanSession | null> {
  const rawCookie = request.cookies.get(FIELD_MANAGER_SCAN_COOKIE_NAME)?.value;
  const claims = rawCookie ? readScanClaims(rawCookie) : null;

  if (!claims || claims.expiresAtMs <= Date.now()) {
    return null;
  }

  const normalizedExpectedCode = expectedPublicAssetCode
    ? normalizePublicAssetCode(expectedPublicAssetCode)
    : "";
  if (
    normalizedExpectedCode &&
    claims.publicAssetCode !== normalizedExpectedCode
  ) {
    return null;
  }

  const activeSession = await getActiveFieldManagerSessionFromRequest(request);
  if (
    !activeSession ||
    activeSession.managerId !== claims.managerId ||
    activeSession.ownerUserId !== claims.ownerUserId
  ) {
    return null;
  }

  const manager = await validateFieldManagerScanAsset({
    managerId: activeSession.managerId,
    ownerUserId: activeSession.ownerUserId,
    publicAssetCode: claims.publicAssetCode,
    assetId: claims.assetId,
  });

  if (!manager || !manager.isActive) {
    return null;
  }

  return {
    managerId: manager.id,
    ownerUserId: manager.ownerUserId,
    displayName: manager.displayName,
    publicAssetCode: claims.publicAssetCode,
    assetId: claims.assetId,
    scanSessionId: claims.scanSessionId,
    expiresAtMs: claims.expiresAtMs,
  };
}

export async function getActiveFieldManagerFuelScanSessionFromRequest(
  request: NextRequest,
  expectedPublicFuelStorageCode?: string,
): Promise<ActiveFieldManagerFuelScanSession | null> {
  const rawCookie = request.cookies.get(
    FIELD_MANAGER_FUEL_SCAN_COOKIE_NAME,
  )?.value;
  const claims = rawCookie ? readFuelScanClaims(rawCookie) : null;

  if (!claims || claims.expiresAtMs <= Date.now()) {
    return null;
  }

  const normalizedExpectedCode = expectedPublicFuelStorageCode
    ? normalizePublicFuelStorageCode(expectedPublicFuelStorageCode)
    : "";

  if (
    normalizedExpectedCode &&
    claims.publicFuelStorageCode !== normalizedExpectedCode
  ) {
    return null;
  }

  const activeSession = await getActiveFieldManagerSessionFromRequest(request);
  if (
    !activeSession ||
    activeSession.managerId !== claims.managerId ||
    activeSession.ownerUserId !== claims.ownerUserId
  ) {
    return null;
  }

  const manager = await validateFieldManagerFuelStorage({
    managerId: activeSession.managerId,
    ownerUserId: activeSession.ownerUserId,
    publicFuelStorageCode: claims.publicFuelStorageCode,
  });

  if (!manager || !manager.isActive) {
    return null;
  }

  return {
    managerId: manager.id,
    ownerUserId: manager.ownerUserId,
    displayName: manager.displayName,
    publicFuelStorageCode: claims.publicFuelStorageCode,
    fuelScanSessionId: claims.fuelScanSessionId,
    expiresAtMs: claims.expiresAtMs,
  };
}
