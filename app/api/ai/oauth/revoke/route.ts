import { checkSharedRate } from '../../../../../lib/ai-connection/rate-limit';
import { getDb } from '../../../../../lib/db';
import { authenticateClient, revokeToken } from '../../../../../lib/ai-connection/store';
import {
  connectionConfig,
  ConnectionError,
  errorResponse,
  json,
  limitedBody,
} from '../../../../../lib/ai-connection/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    let config = connectionConfig();
    if (config.sharedLimits) await checkSharedRate(getDb(), 'oauth:revoke', 1200);
    const form = new URLSearchParams(await limitedBody(request));
    for (const key of Array.from(form.keys())) if (form.getAll(key).length !== 1) throw new ConnectionError(400, 'invalid_request', 'Repeated parameter.');
    try { config = authenticateClient(form, request.headers.get('authorization'), config); }
    catch { config = authenticateClient(form, request.headers.get('authorization'), connectionConfig(process.env, 'admin')); }
    await revokeToken(getDb(), form.get('token') || '', config);
    return json({});
  } catch (error) {
    return errorResponse(error);
  }
}
