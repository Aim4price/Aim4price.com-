import { NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({
      ok: true,
      signedIn: false,
      user: null,
    });
  }

  return NextResponse.json({
    ok: true,
    signedIn: true,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
  });
}