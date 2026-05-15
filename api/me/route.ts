import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../lib/account-profile';
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

  let displayName = session.user.name;
  let accountType = 'owner';

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    displayName = profile.name || displayName;
    accountType = profile.accountType || 'owner';
  } catch (error) {
    console.error('Failed to load account profile for session menu', error);
  }

  return NextResponse.json({
    ok: true,
    signedIn: true,
    user: {
      id: session.user.id,
      name: displayName,
      email: session.user.email,
      accountType,
    },
  });
}
