import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { listVideoSlots, saveTutorialVideo, validVideoSlot, VideoConflict } from '../../../../lib/tutorial-videos';
import { MAX_TUTORIAL_VIDEO_BYTES } from '../../../../lib/tutorial-video-policy';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const access=await requireAdminApiAccess();if(!access.ok)return access.response;try{return json({slots:await listVideoSlots()});}catch(e){console.error('Video manager load',e);return json({error:'Unable to load videos. Please retry.'},500);}}
export async function POST(request:NextRequest){
 const access=await requireAdminApiAccess();if(!access.ok)return access.response;
 if(!isTrustedRequestOrigin(request.headers.get('origin'),request.nextUrl.origin))return json({error:'Invalid request origin.'},403);
 const q=request.nextUrl.searchParams,audience=q.get('audience'),feature=q.get('feature'),action=q.get('action'),revision=Number(q.get('revision'));
 if(!validVideoSlot(audience,feature)||!q.has('revision')||!Number.isSafeInteger(revision)||revision<0||!['upload','publish','unpublish','discard'].includes(action||''))return json({error:'Choose a valid video and action.'},400);
 try {
  let bytes:Buffer|undefined;
  if(action==='upload'){
   if(Number(request.headers.get('content-length'))>MAX_TUTORIAL_VIDEO_BYTES)return json({error:'Videos must be 100 MB or smaller.'},413);
   const reader=request.body?.getReader();if(!reader)return json({error:'Choose a video file.'},400);
   const chunks:Uint8Array[]=[];let size=0;
   while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_TUTORIAL_VIDEO_BYTES){await reader.cancel();return json({error:'Videos must be 100 MB or smaller.'},413);}chunks.push(part.value);}
   bytes=Buffer.concat(chunks);
  }
  await saveTutorialVideo({audience:audience!,feature:feature!,revision,actor:access.actor.userId,action:action as 'upload'|'publish'|'unpublish'|'discard',bytes,name:q.get('name')||undefined,draftId:q.get('draftId')||undefined});
  return json({slots:await listVideoSlots()});
 }catch(e){if(e instanceof VideoConflict)return json({error:e.message},409);console.error('Video manager save',e);return json({error:action==='upload'?'Upload failed. Use an MP4 or WebM video up to 100 MB and retry.':'Unable to save. Refresh and try again.'},400);}
}
