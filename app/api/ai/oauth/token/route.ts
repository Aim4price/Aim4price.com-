import { checkSharedRate } from '../../../../../lib/ai-connection/rate-limit';
import { getDb } from '../../../../../lib/db';
import {
  authenticateClient,
  exchangeToken,
} from '../../../../../lib/ai-connection/store';
import {
  connectionConfig,
  ConnectionError,
  errorResponse,
  json,
  limitedBody,
} from '../../../../../lib/ai-connection/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    let config = connectionConfig();
    if (config.sharedLimits) await checkSharedRate(getDb(), 'oauth:token', 1200);
    if (
      !request.headers
        .get('content-type')
        ?.includes('application/x-www-form-urlencoded')
    )
      throw new ConnectionError(
        415,
        'invalid_request',
        'Use form-encoded parameters.',
      );
    const form = new URLSearchParams(await limitedBody(request));
    for (const key of Array.from(form.keys()))
      if (form.getAll(key).length !== 1)
        throw new ConnectionError(
          400,
          'invalid_request',
          'Repeated parameter.',
        );
    if (form.get('resource') === config.origin + '/api/ai/admin/mcp') config = connectionConfig(process.env, 'admin');
    config = authenticateClient(form, request.headers.get('authorization'), config);
    return json(await exchangeToken(getDb(), form, config));
  } catch (error) {
    return errorResponse(error);
  }
}
