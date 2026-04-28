import { NextRequest, NextResponse } from 'next/server';
import { isSectorKey, type SectorKey } from '../../../lib/equipment-types';
import { normalizeSpecsJson, saveModelCandidate } from '../../../lib/generic-valuation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  sectorKey?: unknown;
  familyKey?: unknown;
  brandSlug?: unknown;
  brandNameSnapshot?: unknown;
  rawModelName?: unknown;
  sourceType?: unknown;
  sourceUrl?: unknown;
  specsJson?: unknown;
  confidence?: unknown;
  notes?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const sectorKey = String(body.sectorKey ?? '').trim();
    const familyKey = String(body.familyKey ?? '').trim();
    const rawModelName = String(body.rawModelName ?? '').trim();
    const sourceType = String(body.sourceType ?? 'user_input').trim();

    if (!isSectorKey(sectorKey)) {
      return NextResponse.json({ ok: false, error: 'Valid sectorKey is required.' }, { status: 400 });
    }

    if (!familyKey || !rawModelName) {
      return NextResponse.json({ ok: false, error: 'familyKey and rawModelName are required.' }, { status: 400 });
    }

    if (!['user_input', 'market_listing', 'scraper', 'admin_import'].includes(sourceType)) {
      return NextResponse.json({ ok: false, error: 'Invalid sourceType.' }, { status: 400 });
    }

    await saveModelCandidate({
      sectorKey: sectorKey as SectorKey,
      familyKey,
      brandSlug: String(body.brandSlug ?? '').trim() || null,
      brandNameSnapshot: String(body.brandNameSnapshot ?? '').trim() || null,
      rawModelName,
      sourceType: sourceType as 'user_input' | 'market_listing' | 'scraper' | 'admin_import',
      sourceUrl: String(body.sourceUrl ?? '').trim() || null,
      specsJson: normalizeSpecsJson(body.specsJson),
      confidence: Number(body.confidence),
      notes: String(body.notes ?? '').trim() || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('model-candidates route failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to save model candidate.' },
      { status: 500 },
    );
  }
}
