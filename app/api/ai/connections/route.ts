import { getDb } from '../../../../lib/db';
import { getAnyServerSession } from '../../../../lib/auth-session';
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
    const config = connectionConfig(process.env, new URL(request.url).searchParams.get('audience') === 'admin' ? 'admin' : 'owner');
    requireSameOrigin(request, config);
    const session = await getAnyServerSession();
    if (!session?.user?.id) throw new ConnectionError(401, 'login_required', 'Sign in to disconnect.');
    const body = JSON.parse(await limitedBody(request));
    if (
      !body ||
      Object.keys(body).some((k) => k !== 'id') ||
      !/^[0-9a-f-]{36}$/i.test(body.id || '')
    )
      throw new ConnectionError(400, 'invalid_request', 'Invalid connection.');
    await getDb().query(
      'UPDATE public.ai_connections SET revoked_at=now() WHERE id=$1::uuid AND user_id=$2 AND resource=$3 AND revoked_at IS NULL',
      [body.id, session.user.id, config.resource],
    );
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
