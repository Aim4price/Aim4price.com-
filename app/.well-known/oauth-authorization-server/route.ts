import {
  connectionConfig,
  errorResponse,
  json,
  READ_SCOPE,
} from '../../../lib/ai-connection/security';
export const dynamic = 'force-dynamic';
export function GET() {
  try {
    const c = connectionConfig();
    return json({
      issuer: c.origin,
      authorization_endpoint: `${c.origin}/api/ai/oauth/authorize`,
      token_endpoint: `${c.origin}/api/ai/oauth/token`,
      revocation_endpoint: `${c.origin}/api/ai/oauth/revoke`,
      scopes_supported: [READ_SCOPE],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic',
      ],
      code_challenge_methods_supported: ['S256'],
      authorization_response_iss_parameter_supported: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
