import { NextResponse } from 'next/server';
import { requireAdminApiAccess } from '../../../../lib/admin-api-access';
import { ensureCaptureAllowanceSchema } from '../../../../lib/capture-allowance';
import { getDb } from '../../../../lib/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  try {
    await ensureCaptureAllowanceSchema();
    const params = new URL(request.url).searchParams;
    const offset = Math.max(0, Math.min(100000, Number(params.get('offset')) || 0));
    const result = await getDb().query(`select a.*,
      coalesce(nullif(p.business_name, ''), nullif(p.display_name, ''), u.name, u.email) as owner_name,
      u.email as owner_email, actor.name as actor_name, actor.email as actor_email,
      count(*) over()::integer as total
      from public.capture_assistance_requests a
      join public."user" u on u.id = a.owner_user_id
      join public."user" actor on actor.id = a.actor_user_id
      left join public.account_profiles p on p.user_id = a.owner_user_id
      where ($1::boolean = false or a.resolved_at is null)
      order by (a.requested_at is not null and a.resolved_at is null) desc, a.shown_at desc, a.id
      limit 50 offset $2`, [params.get('open') !== '0', offset]);
    const count = await getDb().query(`select count(*)::integer as pending from public.capture_assistance_requests where requested_at is not null and resolved_at is null`);
    return NextResponse.json({ ok: true, rows: result.rows, total: result.rows[0]?.total || 0, pending: count.rows[0].pending });
  } catch (error) {
    console.error('Capture assistance list failed', error);
    return NextResponse.json({ error: 'Assistance activity could not be loaded.' }, { status: 503 });
  }
}
export async function PATCH(request: Request) {
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  try {
    const body = await request.json();
    if (!/^[0-9a-f-]{36}$/i.test(String(body.id)) || typeof body.resolved !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    await ensureCaptureAllowanceSchema();
    const result = await getDb().query(`update public.capture_assistance_requests set resolved_at = case when $2 then now() else null end where id = $1::uuid returning id`, [body.id, body.resolved]);
    if (!result.rowCount) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Capture assistance update failed', error);
    return NextResponse.json({ error: 'The follow-up could not be updated.' }, { status: 503 });
  }
}
