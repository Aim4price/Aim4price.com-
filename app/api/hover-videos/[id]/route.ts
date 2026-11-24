import { NextRequest } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { getAccountProfile } from '../../../../lib/account-profile';
import { hoverAudience } from '../../../../lib/hover-video-policy';
import { ensureHoverVideos } from '../../../../lib/hover-videos';
import { videoByteRange } from '../../../../lib/tutorial-video-policy';
import { getDb } from '../../../../lib/db';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, {params}: {params:{id:string}}) {
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(params.id)) return new Response(null, {status:404});
  let audience: string | null = null;
  if (request.nextUrl.searchParams.has('admin')) {
    const access = await requireAdminApiAccess();
    if (!access.ok) return access.response;
  } else {
    const session = await getServerSession({requireActive:false});
    if (!session?.user) return new Response(null, {status:401});
    audience = hoverAudience(await getAccountProfile(session.user));
    if (!audience) return new Response(null, {status:403});
  }
  await ensureHoverVideos();
  const row = (await getDb().query('SELECT mime, octet_length(data) AS size FROM workspace_hover_videos WHERE id=$1 AND ($2::text IS NULL OR audience=$2)', [params.id, audience])).rows[0];
  if (!row) return new Response(null, {status:404});
  const range = videoByteRange(request.headers.get('range'), row.size);
  if (!range) return new Response(null, {status:416, headers:{'Content-Range':`bytes */${row.size}`}});
  const length = range.end - range.start + 1;
  const bytes = (await getDb().query('SELECT substring(data FROM $2 FOR $3) AS chunk FROM workspace_hover_videos WHERE id=$1', [params.id, range.start+1, length])).rows[0];
  if (!bytes) return new Response(null, {status:404});
  const headers = new Headers({'Accept-Ranges':'bytes', 'Content-Type':row.mime, 'Content-Length':String(length), 'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
  if (request.headers.has('range')) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${row.size}`);
  return new Response(new Uint8Array(bytes.chunk), {headers, status:request.headers.has('range') ? 206 : 200});
}
