import { getDb } from '../../../lib/db';
import { connectionOwner } from '../../../lib/ai-connection/browser';
import { authorizationRequest, connectionConfig, ConnectionError, consentProof } from '../../../lib/ai-connection/security';
import ConnectionView from './connection-view';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI connections | Aim4price', robots: { index: false, follow: false } };
export default async function AiConnectionPage({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach(v => params.append(key, v));
    else if (value !== undefined) params.set(key, value);
  }
  try {
    const config = connectionConfig();
    const auth = params.size ? authorizationRequest(params, config) : null;
    const owner = await connectionOwner(config);
    const connections = (await getDb().query(
      `SELECT id,created_at,expires_at FROM public.ai_connections WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC`, [owner.account.id],
    )).rows.map(c => ({ id: String(c.id), created_at: new Date(c.created_at).toISOString(), expires_at: new Date(c.expires_at).toISOString() }));
    return <ConnectionView account={owner.account} connections={connections} resource={config.resource} proof={auth ? consentProof(auth, owner.account.id, owner.sessionId, config.signingSecret) : undefined} />;
  } catch (error) {
    if (error instanceof ConnectionError && error.status === 401) {
      const returnTo = '/account/ai-connect' + (params.size ? '?' + params.toString() : '');
      return <ConnectionView signInHref={`/auth?accountAccess=desktop&returnTo=${encodeURIComponent(returnTo)}#login`} />;
    }
    const disabled = error instanceof ConnectionError && error.code === 'unavailable';
    return <ConnectionView disabled={disabled} message={disabled ? 'We’re preparing the first read-only AI connection. You can explore what it will share below. Connecting is not available yet.' : error instanceof ConnectionError ? error.message : 'We couldn’t load your connection details. Please try again later.'} />;
  }
}
