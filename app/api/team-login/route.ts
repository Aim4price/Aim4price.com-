import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getAnyServerSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import { sharingPlan } from '../../../lib/sharing-foundation';
import { getDb } from '../../../lib/db';
import { ensureTeamAccessSchema } from '../../../lib/team-access-schema';
import { authenticateTeamLogin, TEAM_LOGIN_COOKIE, TEAM_LOGIN_AGE, teamTokenHash } from '../../../lib/team-login';
import { TeamAccessError } from '../../../lib/team-access-policy';
import { teamJson, teamError } from '../../../lib/team-access-http';
import { requireBusinessOrigin, businessBody } from '../../../lib/business-network-api';
import { limitBusinessAction } from '../../../lib/business-network';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    requireBusinessOrigin(request);
    const body = await businessBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const business = String(body.business || '');
    const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    try {
      await limitBusinessAction('desktop-login-ip:' + address, 30);
      await limitBusinessAction('desktop-login:' + business + ':' + email, 5);
    } catch (error) {
      if (error instanceof Error && error.message === 'Too many requests. Please try again later.') throw new TeamAccessError('Too many sign-in attempts. Try again in an hour.', 429);
      throw error;
    }
    if ((await getAnyServerSession())?.user?.id) throw new TeamAccessError('Sign out of your current account before using a separate desktop login.', 409);
    if (!business || business.length > 128 || email.length > 254 || typeof body.password !== 'string' || body.password.length > 128) throw new TeamAccessError('Check the business sign-in link, email and password.', 400);
    const token = await authenticateTeamLogin(business, email, body.password);
    const profile = await getAccountProfile({ id: business });
    if (!['owner', 'dealer'].includes(profile.accountType) || profile.accountStatus !== 'active' || await sharingPlan(business, profile.accountType) !== 'desktop') {
      await getDb().query('DELETE FROM team_access_sessions WHERE token_hash=$1', [teamTokenHash(token)]);
      throw new TeamAccessError('Desktop access is unavailable.', 403);
    }
    const response = teamJson({ ok: true });
    response.cookies.set(TEAM_LOGIN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: TEAM_LOGIN_AGE });
    return response;
  } catch (error) { return teamError(error); }
}
export async function DELETE(request: NextRequest) {
  try {
    requireBusinessOrigin(request);
    const token = cookies().get(TEAM_LOGIN_COOKIE)?.value;
    if (token) { await ensureTeamAccessSchema(); await getDb().query('DELETE FROM team_access_sessions WHERE token_hash=$1', [teamTokenHash(token)]); }
    const response = teamJson({ ok: true });
    response.cookies.set(TEAM_LOGIN_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch (error) { return teamError(error); }
}
