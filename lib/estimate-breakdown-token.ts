import { createHmac, timingSafeEqual } from 'node:crypto';
import type { EstimateBreakdown } from './estimate-breakdown';

function signature(payload: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('Estimate breakdown signing is not configured.');
  return createHmac('sha256', secret).update(`estimate-breakdown:${payload}`).digest('base64url');
}

export function signEstimateBreakdown(report: EstimateBreakdown | null, userId: string): string | undefined {
  if (!report) return undefined;
  const payload = Buffer.from(JSON.stringify({ report, userId, expires: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function verifyEstimateBreakdown(token: unknown, userId: string): EstimateBreakdown | null {
  if (typeof token !== 'string' || token.length > 50000) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = Buffer.from(signature(parts[0]));
  const supplied = Buffer.from(parts[1]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return value.userId === userId && value.expires > Date.now() ? value.report : null;
  } catch { return null; }
}
