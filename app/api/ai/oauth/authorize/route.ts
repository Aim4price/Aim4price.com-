import { getDb } from '../../../../../lib/db';
import { connectionOwner } from '../../../../../lib/ai-connection/browser';
import { issueCode } from '../../../../../lib/ai-connection/store';
import {
  authorizationRequest,
  connectionConfig,
  requireConsentTerms,
  errorResponse,
  limitedBody,
  requireSameOrigin,
  verifyConsent,
} from '../../../../../lib/ai-connection/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const config = connectionConfig();
    const params = new URL(request.url).searchParams;
    authorizationRequest(params, config);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${config.origin}/account/ai-connect?${params}`,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const config = connectionConfig();
    requireSameOrigin(request, config);
    const owner = await connectionOwner(config);
    const form = new URLSearchParams(await limitedBody(request));
    const proof = form.get('proof') || '';
    const auth = verifyConsent(
      proof,
      owner.account.id,
      owner.sessionId,
      config,
    );
    const callback = new URL(auth.redirectUri);
    callback.searchParams.set('state', auth.state);
    callback.searchParams.set('iss', config.origin);
    if (form.get('decision') !== 'allow')
      callback.searchParams.set('error', 'access_denied');
    else {
      requireConsentTerms(form);
      callback.searchParams.set(
        'code',
        await issueCode(getDb(), owner.account.id, auth, proof, config),
      );
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: callback.toString(),
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
