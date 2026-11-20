import { NextRequest, NextResponse } from 'next/server';
import { sagePage, sageTokens, unseal } from '../../../../../lib/sage-za-api';
import { sageOwner, saveAuthorisation } from '../../../../../lib/sage-za-connection';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await sageOwner();
  let destination = sagePage;
  try {
    const cookie = request.cookies.get('__Host-sage-za-state')?.value || '';
    const {state, until} = JSON.parse(unseal(cookie, 'oauth/'+ctx.owner, ctx.config.key));
    const code = request.nextUrl.searchParams.get('code');
    if (!code || Date.now() >= until || state !== request.nextUrl.searchParams.get('state')) throw new Error('Invalid callback.');
    await saveAuthorisation(ctx, await sageTokens(ctx.config, {code}));
  } catch {
    destination += '?error=1';
  }
  const response = NextResponse.redirect(new URL(destination, ctx.config.origin), 303);
  response.headers.set('Cache-Control','no-store');
  response.headers.set('Referrer-Policy','no-referrer');
  response.cookies.set('__Host-sage-za-state','',{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:0});
  return response;
}
