import { NextRequest, NextResponse } from 'next/server';

import { enhanceEstimateReportHtml } from '../../../../lib/estimate-report-enhancement';
import { POST as renderBaseValuationReport } from '../report/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function readPayload(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    return request.json();
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const rawPayload = formData.get('payload');
    if (typeof rawPayload !== 'string' || !rawPayload.trim()) return null;
    return JSON.parse(rawPayload);
  }

  const body = await request.text();
  return body.trim() ? JSON.parse(body) : null;
}

export async function POST(request: NextRequest) {
  const payloadRequest = request.clone();
  const baseResponse = await renderBaseValuationReport(request);
  const contentType = baseResponse.headers.get('content-type')?.toLowerCase() ?? '';

  if (!contentType.includes('text/html')) {
    return baseResponse;
  }

  let rawPayload: unknown = null;
  try {
    rawPayload = await readPayload(payloadRequest);
  } catch {
    // The base report has already validated the request. Enhancement data is optional.
  }

  const baseHtml = await baseResponse.text();
  const html = enhanceEstimateReportHtml(baseHtml, rawPayload);
  const headers = new Headers(baseResponse.headers);
  headers.delete('content-length');
  headers.set('Cache-Control', 'no-store');

  return new NextResponse(html, {
    status: baseResponse.status,
    headers,
  });
}
