import {
  connectionConfig,
  errorResponse,
  json,
  READ_SCOPE,
} from '../../../../../../lib/ai-connection/security';
export const dynamic = 'force-dynamic';
export function GET() {
  try {
    const c = connectionConfig();
    return json({
      resource: c.resource,
      authorization_servers: [c.origin],
      scopes_supported: [READ_SCOPE],
      bearer_methods_supported: ['header'],
      resource_name: 'Aim4price read-only account',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
