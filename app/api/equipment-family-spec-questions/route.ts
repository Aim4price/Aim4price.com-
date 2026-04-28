import { NextRequest, NextResponse } from 'next/server';
import { isSectorKey, type SectorKey } from '../../../lib/equipment-types';
import { listFamilySpecQuestions } from '../../../lib/generic-valuation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectorKeyParam = searchParams.get('sectorKey');
    const familyKey = searchParams.get('familyKey')?.trim() ?? '';
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (sectorKeyParam && !isSectorKey(sectorKeyParam)) {
      return NextResponse.json({ ok: false, error: 'Invalid sectorKey.' }, { status: 400 });
    }

    if (!familyKey) {
      return NextResponse.json({ ok: false, error: 'familyKey is required.' }, { status: 400 });
    }

    const questions = await listFamilySpecQuestions({
      sectorKey: (sectorKeyParam as SectorKey | null) ?? null,
      familyKey,
      includeInactive,
    });

    return NextResponse.json({ ok: true, count: questions.length, questions });
  } catch (error) {
    console.error('equipment-family-spec-questions route failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load spec questions.' },
      { status: 500 },
    );
  }
}
