import { checkSharedRate } from '../../../../../lib/ai-connection/rate-limit';
import { getDb } from '../../../../../lib/db';
import { connectionOwner } from '../../../../../lib/ai-connection/browser';
import { issueCode } from '../../../../../lib/ai-connection/store';
import {
  authorizationRequest,
  authorizationConfig,
  connectionPage,
  connectionConfig,
  connectionSignInHref,
  ConnectionError,
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
    const params = new URL(request.url).searchParams;
    const config = authorizationConfig(params, connectionConfig());
    if (config.sharedLimits) await checkSharedRate(getDb(), 'oauth:authorize', 1200);
    authorizationRequest(params, config);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${config.origin}${connectionPage(config)}?${params}`,
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
    let config = connectionConfig();
    requireSameOrigin(request, config);
    if (config.sharedLimits) await checkSharedRate(getDb(), 'oauth:consent', 1200);
    const form = new URLSearchParams(await limitedBody(request));
    const authorization = new URLSearchParams(form.get('authorization') || '');
    if (authorization.size) {
      config = authorizationConfig(authorization, config);
      authorizationRequest(authorization, config);
    }
    let owner;
    try {
      owner = await connectionOwner(config);
    } catch (error) {
      if (error instanceof ConnectionError && error.code === 'login_required') {
        const params = new URLSearchParams(form.get('authorization') || '');
        // Legacy consent pages lack resume parameters: sign in, then restart the connection.
        const href = params.size ? connectionSignInHref(params, config)
          : '/auth?accountAccess=desktop&returnTo=%2Faccount%2Fai-connect#login';
        return new Response(null, { status: 303, headers: {
          Location: config.origin + href, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
        } });
      }
      throw error;
    }
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
