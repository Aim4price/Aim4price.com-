import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { auth } from '../../../../lib/auth';
import { getBillingEmailPreference, saveBillingEmailPreference } from '../../../../lib/billing-preferences';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return Response.json({ error: 'Sign in to manage billing emails.' }, { status: 401 });
  return Response.json(await getBillingEmailPreference(session.user.id));
}
export async function PUT(request: Request) {
  if (!isTrustedRequestOrigin(request.headers.get('origin'), new URL(request.url).origin)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return Response.json({ error: 'Sign in to manage billing emails.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.useBusinessEmail !== 'boolean') return Response.json({ error: 'Choose an email for billing.' }, { status: 400 });
  const current = await getBillingEmailPreference(session.user.id);
  if (body.useBusinessEmail && !current.businessEmail) return Response.json({ error: 'Save a business email first.' }, { status: 400 });
  await saveBillingEmailPreference(session.user.id, body.useBusinessEmail);
  return Response.json(await getBillingEmailPreference(session.user.id));
}
