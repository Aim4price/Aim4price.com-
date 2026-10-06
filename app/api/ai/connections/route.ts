import { getDb } from '../../../../lib/db';
import { connectionOwner } from '../../../../lib/ai-connection/browser';
import {
  connectionConfig,
  ConnectionError,
  errorResponse,
  json,
  limitedBody,
  requireSameOrigin,
} from '../../../../lib/ai-connection/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function DELETE(request: Request) {
  try {
    const config = connectionConfig();
    requireSameOrigin(request, config);
    const owner = await connectionOwner(config);
    const body = JSON.parse(await limitedBody(request));
    if (
      !body ||
      Object.keys(body).some((k) => k !== 'id') ||
      !/^[0-9a-f-]{36}$/i.test(body.id || '')
    )
      throw new ConnectionError(400, 'invalid_request', 'Invalid connection.');
    await getDb().query(
      'UPDATE public.ai_connections SET revoked_at=now() WHERE id=$1::uuid AND user_id=$2 AND revoked_at IS NULL',
      [body.id, owner.account.id],
    );
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
