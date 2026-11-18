import { NextRequest } from 'next/server';
import { businessBody, businessError, businessJson, requireBusinessOrigin } from '../../../../../lib/business-network-api';
import { limitBusinessAction } from '../../../../../lib/business-network';
import { businessText } from '../../../../../lib/business-network-shared';
export const runtime = 'nodejs';

// Public onboarding only: bounded text search, no account data or profile mutations.
export async function POST(request: NextRequest) {
  try {
    requireBusinessOrigin(request);
    const body = await businessBody(request);
    const query = businessText(body.query, 200);
    if (query.length < 3) throw new Error('Enter your business name and town.');
    await limitBusinessAction(`accept-google-ip:${request.headers.get('x-forwarded-for') || 'unknown'}`, 10);
    await limitBusinessAction('accept-google-total', 200);
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) return businessJson({ error: 'Google search is unavailable. You can enter your details below or paste your Google Maps link.' }, 503);
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.googleMapsUri' },
      body: JSON.stringify({ textQuery: query, regionCode: 'ZA', maxResultCount: 5 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Google search is unavailable. Please enter your details below.');
    const data = await response.json();
    return businessJson({ places: Array.isArray(data.places) ? data.places.slice(0, 5) : [] });
  } catch (error) { return businessError(error); }
}
