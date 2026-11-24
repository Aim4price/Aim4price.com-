import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { listVideoSlots, saveTutorialVideo, validVideoSlot, VideoConflict } from '../../../../lib/tutorial-videos';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const access=await requireAdminApiAccess();if(!access.ok)return access.response;try{return json({slots:await listVideoSlots()});}catch(e){console.error('Video manager load',e);return json({error:'Unable to load videos. Please retry.'},500);}}
export async function POST(request:NextRequest){
 const access=await requireAdminApiAccess();if(!access.ok)return access.response;
 if(!isTrustedRequestOrigin(request.headers.get('origin'),request.nextUrl.origin))return json({error:'Invalid request origin.'},403);
 const q=request.nextUrl.searchParams,audience=q.get('audience'),feature=q.get('feature'),action=q.get('action'),revision=Number(q.get('revision'));
 if((audience!=='owners' && audience!=='businesses')||!validVideoSlot(audience,feature)||!q.has('revision')||!Number.isSafeInteger(revision)||revision<0||!['link','publish','unpublish','discard'].includes(action||''))return json({error:'Choose a valid video and action.'},400);
 try {
  await saveTutorialVideo({audience:audience!,feature:feature!,revision,actor:access.actor.userId,action:action as 'link'|'publish'|'unpublish'|'discard',link:q.get('link')||undefined,draftId:q.get('draftId')||undefined});
  return json({slots:await listVideoSlots()});
 }catch(e){if(e instanceof VideoConflict)return json({error:e.message},409);console.error('Video manager save',e);return json({error:action==='link'?'Unable to save this YouTube link. Check the link and try again.':'Unable to save. Refresh and try again.'},400);}
}
