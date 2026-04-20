import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const HASH_PREFIX = 'scrypt';

export function normalizeScanPin(input: unknown): string {
  return String(input ?? '')
    .replace(/\s+/g, '')
    .trim();
}

export function validateScanPin(input: unknown): string {
  const pin = normalizeScanPin(input);

  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('Scan PIN must be 4 to 8 digits.');
  }

  return pin;
}

export async function hashScanPin(input: unknown): Promise<string> {
  const pin = validateScanPin(input);
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(pin, salt, KEY_LENGTH)) as Buffer;

  return `${HASH_PREFIX}$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyScanPin(input: unknown, storedHash: string): Promise<boolean> {
  const pin = validateScanPin(input);
  const [prefix, salt, expectedHash] = String(storedHash ?? '').split('$');

  if (prefix !== HASH_PREFIX || !salt || !expectedHash) {
    return false;
  }

  const expected = Buffer.from(expectedHash, 'hex');
  if (!expected.length) {
    return false;
  }

  const derivedKey = (await scrypt(pin, salt, expected.length)) as Buffer;
  return timingSafeEqual(expected, derivedKey);
}
