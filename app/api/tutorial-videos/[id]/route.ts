import { NextRequest } from 'next/server';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { isAim4priceAdminEmail } from '../../../../lib/account-constants';
import { canViewTutorialPreview } from '../../../../lib/tutorial-preview-access';
import { ensureTutorialVideos } from '../../../../lib/tutorial-videos';
import { getDb } from '../../../../lib/db';
import { videoByteRange } from '../../../../lib/tutorial-video-policy';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:{id:string}}){
 const session=await getAnyServerSession();
 if(!canViewTutorialPreview(session?.user))return new Response(null,{status:401});
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id))return new Response(null,{status:404});
 await ensureTutorialVideos();
 const row=(await getDb().query(`SELECT f.byte_size,f.content_type FROM tutorial_video_files f WHERE f.id=$1 AND ($2 OR EXISTS(SELECT 1 FROM tutorial_video_slots s WHERE s.published_id=f.id))`,[params.id,isAim4priceAdminEmail(session?.user.email)])).rows[0];
 if(!row)return new Response(null,{status:404});
 const range=videoByteRange(request.headers.get('range'),row.byte_size);
 if(!range)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${row.byte_size}`}});
 let offset=range.start;const end=range.end;
 const stream=new ReadableStream<Uint8Array>({async pull(controller){try{if(offset>end){controller.close();return;}const length=Math.min(1024*1024,end-offset+1);const r=await getDb().query('SELECT substring(data from $2 for $3) AS chunk FROM tutorial_video_files WHERE id=$1',[params.id,offset+1,length]);const chunk=r.rows[0]?.chunk;if(!chunk?.length)throw Error('Missing video bytes');offset+=chunk.length;controller.enqueue(new Uint8Array(chunk));}catch(e){controller.error(e);}}});
 const headers:Record<string,string>={'Content-Type':row.content_type,'Content-Length':String(end-range.start+1),'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 if(request.headers.has('range'))headers['Content-Range']=`bytes ${range.start}-${end}/${row.byte_size}`;
 return new Response(stream,{status:request.headers.has('range')?206:200,headers});
}
