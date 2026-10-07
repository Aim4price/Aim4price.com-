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
    const config = connectionConfig();
    const form = new URLSearchParams(await limitedBody(request));
    authenticateClient(form, request.headers.get('authorization'), config);
    await getDb().query(
      `UPDATE public.ai_connections SET revoked_at=now() WHERE client_id=$1 AND (access_hash=$2 OR refresh_hash=$2) AND revoked_at IS NULL`,
      [config.clientId, digest(form.get('token') || '')],
    );
    return json({});
  } catch (error) {
    return errorResponse(error);
  }
}
