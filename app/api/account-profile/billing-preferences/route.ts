import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { auth } from '../../../../lib/auth';
import { receivesBillingEmails, saveBillingEmailPreference } from '../../../../lib/billing-preferences';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return Response.json({ error: 'Sign in to manage billing emails.' }, { status: 401 });
  return Response.json({ enabled: await receivesBillingEmails(session.user.id) });
}
export async function PUT(request: Request) {
  if (!isTrustedRequestOrigin(request.headers.get('origin'), new URL(request.url).origin)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return Response.json({ error: 'Sign in to manage billing emails.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== 'boolean') return Response.json({ error: 'Choose whether to receive billing emails.' }, { status: 400 });
  await saveBillingEmailPreference(session.user.id, body.enabled);
  return Response.json({ enabled: body.enabled });
}
