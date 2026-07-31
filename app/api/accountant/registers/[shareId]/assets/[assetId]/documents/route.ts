import { NextRequest, NextResponse } from 'next/server';
import { accountantWorkspaceError, uploadAccountantDocument } from '../../../../../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string; assetId: string } };

export async function POST(request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'Choose a document.' }, { status: 400 });
    const item = await uploadAccountantDocument({
      accountantUserId: session.user.id,
      shareId: context.params.shareId,
      assetId: context.params.assetId,
      file,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error('accountant document POST failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
