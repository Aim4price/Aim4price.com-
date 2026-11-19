import { NextRequest, NextResponse } from 'next/server';
import { limitBusinessAction } from '../../../../../lib/business-network';
import { assetSharePasswordCookie, unlockAssetSharePassword } from '../../../../../lib/asset-share-links';
import { isTrustedRequestOrigin } from '../../../../../lib/trusted-request-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  if (!isTrustedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin))
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  if (!/^[A-Za-z0-9_-]{43}$/.test(params.token))
    return NextResponse.json({ error: 'This asset link is unavailable.' }, { status: 404, headers });
  try {
    await limitBusinessAction(`asset-share-password:${params.token}`, 30);
    const reader=request.body?.getReader();
    if(!reader)return NextResponse.json({error:'Enter the link password.'},{status:400,headers});
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2048){await reader.cancel();return NextResponse.json({error:'Enter the link password.'},{status:413,headers});}chunks.push(part.value);}
    let body:Record<string,unknown>;
    try{body=JSON.parse(Buffer.concat(chunks).toString());if(!body||Array.isArray(body)||typeof body!=='object')throw Error();}catch{return NextResponse.json({error:'Enter the link password.'},{status:400,headers});}
    const proof = await unlockAssetSharePassword(params.token, body?.password);
    const response = NextResponse.json({ ok: true }, { headers });
    if (proof) response.cookies.set(assetSharePasswordCookie(params.token), proof, {
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to open this asset link.';
    const status = message === 'The password is incorrect.' ? 403 : message.includes('unavailable') ? 404 : 400;
    return NextResponse.json({ error: message }, { status, headers });
  }
}
