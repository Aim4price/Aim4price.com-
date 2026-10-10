import {
  connectionConfig,
  errorResponse,
  json,
  ADMIN_READ_SCOPE,
} from '../../../../../../../lib/ai-connection/security';
export const dynamic = 'force-dynamic';
export function GET() {
  try {
    const c = connectionConfig(process.env, 'admin');
    return json({
      resource: c.resource,
      authorization_servers: [c.origin],
      scopes_supported: [ADMIN_READ_SCOPE],
      bearer_methods_supported: ['header'],
      resource_name: 'Aim4price private admin reporting',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
