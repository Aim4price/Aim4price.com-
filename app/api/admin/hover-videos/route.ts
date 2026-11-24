import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { validHoverTarget, maxRecordingBytes } from '../../../../lib/hover-video-policy';
import { ensureHoverVideos } from '../../../../lib/hover-videos';
import { getDb } from '../../../../lib/db';

export const runtime = 'nodejs';
const fail = (error: string, status: number) => NextResponse.json({error}, {status});

export async function POST(request: NextRequest) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  if (!isTrustedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin)) return fail('Invalid origin.', 403);
  const params = request.nextUrl.searchParams;
  const audience = params.get('audience'), card = params.get('card'), previous = params.get('previous');
  if (!validHoverTarget(audience, card) || (previous && !/^[\da-f-]{36}$/i.test(previous))) return fail('Choose a workspace card.', 400);
  await ensureHoverVideos();
  if (params.get('action') === 'remove') {
    const deleted = await getDb().query('DELETE FROM workspace_hover_videos WHERE audience=$1 AND card=$2 AND id=$3', [audience, card, previous]);
    return deleted.rowCount ? NextResponse.json({id:null}) : fail('The recording changed. Reload this page.', 409);
  }
  if (Number(request.headers.get('content-length')) > maxRecordingBytes) return fail('Choose a recording under 25 MB.', 413);
  const reader = request.body?.getReader();
  if (!reader) return fail('Choose a recording.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxRecordingBytes) { await reader.cancel(); return fail('Choose a recording under 25 MB.', 413); }
    chunks.push(value);
  }
  const data = Buffer.concat(chunks);
  const mime = data.toString('ascii', 4, 8) === 'ftyp' ? 'video/mp4'
    : data.subarray(0,4).toString('hex') === '1a45dfa3' ? 'video/webm' : null;
  if (!mime) return fail('Choose an MP4 or WebM screen recording.', 415);
  const id = randomUUID();
  const result = previous
    ? await getDb().query('UPDATE workspace_hover_videos SET id=$4, mime=$5, data=$6 WHERE audience=$1 AND card=$2 AND id=$3', [audience, card, previous, id, mime, data])
    : await getDb().query('INSERT INTO workspace_hover_videos(audience,card,id,mime,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [audience, card, id, mime, data]);
  return result.rowCount ? NextResponse.json({id}) : fail('The recording changed. Reload this page.', 409);
}
