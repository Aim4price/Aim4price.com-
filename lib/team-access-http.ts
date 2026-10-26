import { NextResponse } from 'next/server';
import { TeamAccessError } from './team-access-policy';
export const TEAM_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', 'Vary': 'Cookie' };
export function teamJson(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: TEAM_HEADERS }); }
export function teamError(error: unknown) {
    if (error instanceof TeamAccessError)
        return teamJson({ ok: false, error: error.message }, error.status);
    console.error('Team workspace request failed', error);
    return teamJson({ ok: false, error: 'Unable to complete this request. Refresh and try again.' }, 400);
}
