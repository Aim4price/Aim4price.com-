import { NextRequest } from 'next/server';
import { businessBody, businessError, businessJson, requireBusinessOrigin } from '../../../../lib/business-network-api';
import { limitBusinessAction } from '../../../../lib/business-network';
import { recordBusinessAcceptance } from '../../../../lib/business-acceptances';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
 try {
  requireBusinessOrigin(request);
  await limitBusinessAction(`accept-ip:${request.headers.get('x-forwarded-for') || 'unknown'}`, 20);
  await recordBusinessAcceptance(await businessBody(request));
  return businessJson({ok:true});
 } catch(error) { return businessError(error); }
}
