import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { searchInvoiceDropAssetByCode } from '../../../../../lib/capture-requests';
import { consumePublicInvoiceDropRateLimit } from '../../../../../lib/public-invoice-drop-rate-limit';
import {
  createPublicInvoiceRateLimitKey,
  isTrustedPublicInvoiceOrigin,
  resolvePublicInvoiceClientAddress,
} from '../../../../../lib/public-invoice-drop-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAXIMUM_BODY_BYTES = 4_096;

function response(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function cleanText(value: unknown, maximumLength: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function formatUsageReading(value: number | null, metric: 'hours' | 'km'): string {
  if (!value || !Number.isFinite(value) || value <= 0) return '';
  return `${Math.round(value).toLocaleString('en-ZA')} ${metric}`;
}

async function readBoundedJson(request: Request): Promise<Record<string, unknown>> {
  const contentType = String(request.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('application/json')) throw new Error('ASSET_SEARCH_CONTENT_TYPE_INVALID');

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAXIMUM_BODY_BYTES) {
    throw new Error('ASSET_SEARCH_REQUEST_TOO_LARGE');
  }
  if (!request.body || request.bodyUsed) throw new Error('ASSET_SEARCH_BODY_INVALID');

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      totalBytes += part.value.byteLength;
      if (totalBytes > MAXIMUM_BODY_BYTES) {
        await reader.cancel('ASSET_SEARCH_REQUEST_TOO_LARGE').catch(() => undefined);
        throw new Error('ASSET_SEARCH_REQUEST_TOO_LARGE');
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const parsed = JSON.parse(new TextDecoder().decode(combined)) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ASSET_SEARCH_BODY_INVALID');
  }
  return parsed as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  if (!isTrustedPublicInvoiceOrigin({
    originHeader: request.headers.get('origin'),
    secFetchSite: request.headers.get('sec-fetch-site'),
    requestOrigin: request.nextUrl.origin,
  })) {
    return response({ ok: false, error: 'This search must be sent from Aim4price.' }, 403);
  }

  try {
    const clientAddress = resolvePublicInvoiceClientAddress({
      runtimeAddress: request.ip,
      forwardedFor: request.headers.get('x-forwarded-for'),
    });
    const baseRateKey = createPublicInvoiceRateLimitKey({ ipAddress: clientAddress });
    const searchRateKey = createHash('sha256').update(`asset-search:${baseRateKey}`).digest('hex');
    const rateLimit = await consumePublicInvoiceDropRateLimit(searchRateKey, {
      limit: 30,
      windowMs: 10 * 60 * 1_000,
    });
    if (!rateLimit.allowed) {
      const limited = response({ ok: false, error: 'Too many searches were made. Please try again shortly.' }, 429);
      limited.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
      return limited;
    }
  } catch (error) {
    console.error('public invoice drop asset search identity failed', error);
    return response({ ok: false, error: 'Asset search is temporarily unavailable.' }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJson(request);
  } catch {
    return response({ ok: false, error: 'The asset search could not be read.' }, 400);
  }

  const invoiceDropCode = cleanText(body.invoiceDropCode, 80).toUpperCase();
  const query = cleanText(body.query, 160);
  if (invoiceDropCode.length < 6) {
    return response({ ok: false, error: 'Enter the complete contribution code.' }, 400);
  }

  try {
    const result = await searchInvoiceDropAssetByCode(invoiceDropCode, query);
    if (!result) {
      return response({ ok: false, error: 'Check the contribution code and try again.' }, 404);
    }
    if (result.scope === 'asset') {
      return response({ ok: true, scope: 'asset', status: 'asset_specific' });
    }
    if (query.length < 3) {
      return response({ ok: true, scope: 'all', status: 'enter_details' });
    }
    if (result.match) {
      const assetTitle = result.match.assetDisplayName;
      const modelName = result.match.modelName;
      const meta = [
        modelName && !assetTitle.toLowerCase().includes(modelName.toLowerCase()) ? modelName : '',
        result.match.yearModel ? `Year Model ${result.match.yearModel}` : '',
        formatUsageReading(result.match.usageReading, result.match.usageMetric),
        result.match.categoryLabel,
        result.match.serialSuffix ? `Serial ending ${result.match.serialSuffix}` : '',
      ].filter(Boolean).join(' · ');
      return response({
        ok: true,
        scope: 'all',
        status: 'matched',
        asset: {
          title: assetTitle,
          meta,
        },
      });
    }
    return response({
      ok: true,
      scope: 'all',
      // Zero and multiple matches intentionally share one response so this
      // endpoint cannot be used to infer the size of an owner's Asset Register.
      status: 'needs_detail',
    });
  } catch (error) {
    console.error('public invoice drop asset search failed', error);
    return response({ ok: false, error: 'Asset search is temporarily unavailable.' }, 503);
  }
}
