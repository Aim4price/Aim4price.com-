import { NextRequest } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { getAccountProfile } from '../../../../lib/account-profile';
import { hoverAudience } from '../../../../lib/card-screenshot-policy';
import { ensureCardScreenshots } from '../../../../lib/card-screenshots';
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
  await ensureCardScreenshots();
  const row = (await getDb().query('SELECT mime, data FROM workspace_card_screenshots WHERE id=$1 AND ($2::text IS NULL OR audience=$2)', [params.id, audience])).rows[0];
  if (!row) return new Response(null, {status:404});
  return new Response(new Uint8Array(row.data), {headers:{
    'Content-Type':row.mime, 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff'
  }});
}
