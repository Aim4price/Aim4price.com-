import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const HASH_PREFIX = "scrypt";

export function normalizeScanPin(input: unknown): string {
  return String(input ?? "")
    .replace(/\s+/g, "")
    .trim();
}

export function validateScanPin(input: unknown): string {
  const pin = normalizeScanPin(input);

  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error("Scan PIN must be 4 to 8 digits.");
  }

  return pin;
}

export async function hashScanPin(input: unknown): Promise<string> {
  const pin = validateScanPin(input);
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(pin, salt, KEY_LENGTH)) as Buffer;

  return `${HASH_PREFIX}$${salt}$${derivedKey.toString("hex")}`;
}

function looksLikeHex(value: string): boolean {
  return (
    value.length > 0 && value.length % 2 === 0 && /^[a-f0-9]+$/i.test(value)
  );
}

function looksLikeBase64Url(value: string): boolean {
  return value.length > 0 && /^[A-Za-z0-9_-]+$/.test(value);
}

async function verifyScryptWithExpectedKey(
  pin: string,
  salt: string,
  expected: Buffer,
): Promise<boolean> {
  if (!salt || !expected.length) {
    return false;
  }

  const derivedKey = (await scrypt(pin, salt, expected.length)) as Buffer;
  return (
    expected.length === derivedKey.length &&
    timingSafeEqual(expected, derivedKey)
  );
}

export async function verifyScanPin(
  input: unknown,
  storedHash: string,
): Promise<boolean> {
  const pin = validateScanPin(input);
  const [prefix, salt, expectedHash] = String(storedHash ?? "").split("$");

  if (prefix !== HASH_PREFIX || !salt || !expectedHash) {
    return false;
  }

  if (looksLikeHex(expectedHash)) {
    const expected = Buffer.from(expectedHash, "hex");
    if (await verifyScryptWithExpectedKey(pin, salt, expected)) {
      return true;
    }
  }

  // Backward compatibility for existing hashes created with the same scrypt
  // scheme but base64url-encoded salt/key material.
  if (looksLikeBase64Url(expectedHash)) {
    try {
      const expected = Buffer.from(expectedHash, "base64url");
      return await verifyScryptWithExpectedKey(pin, salt, expected);
    } catch {
      return false;
    }
  }

  return false;
}
