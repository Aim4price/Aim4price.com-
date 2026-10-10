import { getDb } from '../../../../../lib/db';
import { handleMcp } from '../../../../../lib/ai-connection/mcp';
import {
  connectionConfig,
  errorResponse,
  json,
} from '../../../../../lib/ai-connection/security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    return await handleMcp(request, getDb(), connectionConfig(process.env, 'admin'));
  } catch (error) {
    return errorResponse(error);
  }
}
export function GET() {
  return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
}
export const DELETE = GET;
export const PUT = GET;
export const PATCH = GET;
