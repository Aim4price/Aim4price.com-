import { checkSharedRate } from '../../../../../lib/ai-connection/rate-limit';
import { getDb } from '../../../../../lib/db';
import { authenticateClient } from '../../../../../lib/ai-connection/store';
import {
  connectionConfig,
  digest,
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
    for (const key of Array.from(form.keys())) if (form.getAll(key).length !== 1) throw new Error('Repeated parameter.');
    try { config = authenticateClient(form, request.headers.get('authorization'), config); }
    catch { config = authenticateClient(form, request.headers.get('authorization'), connectionConfig(process.env, 'admin')); }
    await getDb().query(
      `UPDATE public.ai_connections SET revoked_at=now() WHERE client_id=$1 AND (access_hash=$2 OR refresh_hash=$2) AND revoked_at IS NULL`,
      [config.clientId, digest(form.get('token') || '')],
    );
    return json({});
  } catch (error) {
    return errorResponse(error);
  }
}
