import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { validHoverTarget, maxScreenshotBytes } from '../../../../lib/card-screenshot-policy';
import { ensureCardScreenshots } from '../../../../lib/card-screenshots';
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
  await ensureCardScreenshots();
  if (params.get('action') === 'remove') {
    const deleted = await getDb().query('DELETE FROM workspace_card_screenshots WHERE audience=$1 AND card=$2 AND id=$3', [audience, card, previous]);
    return deleted.rowCount ? NextResponse.json({id:null}) : fail('The screenshot changed. Reload this page.', 409);
  }
  if (Number(request.headers.get('content-length')) > maxScreenshotBytes) return fail('Choose a screenshot under 5 MB.', 413);
  const reader = request.body?.getReader();
  if (!reader) return fail('Choose a screenshot.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxScreenshotBytes) { await reader.cancel(); return fail('Choose a screenshot under 5 MB.', 413); }
    chunks.push(value);
  }
  const data = Buffer.concat(chunks);
  const png = data.subarray(0,8).toString('hex') === '89504e470d0a1a0a' && data.toString('ascii',12,16) === 'IHDR';
  const jpeg = data.subarray(0,3).toString('hex') === 'ffd8ff';
  const mime = png ? 'image/png' : jpeg ? 'image/jpeg' : null;
  if (!mime) return fail('Choose a PNG or JPEG screenshot.', 415);
  const id = randomUUID();
  const result = previous
    ? await getDb().query('UPDATE workspace_card_screenshots SET id=$4, mime=$5, data=$6 WHERE audience=$1 AND card=$2 AND id=$3', [audience, card, previous, id, mime, data])
    : await getDb().query('INSERT INTO workspace_card_screenshots(audience,card,id,mime,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [audience, card, id, mime, data]);
  return result.rowCount ? NextResponse.json({id}) : fail('The screenshot changed. Reload this page.', 409);
}
