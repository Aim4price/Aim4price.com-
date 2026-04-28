import { NextRequest, NextResponse } from 'next/server';
import { isSectorKey, type SectorKey } from '../../../../lib/equipment-types';
import { findMarketVaultMatches, normalizeSpecsJson } from '../../../../lib/generic-valuation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  sectorKey?: unknown;
  familyKey?: unknown;
  brandSlug?: unknown;
  typedModelName?: unknown;
  specsJson?: unknown;
  limit?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const sectorKey = String(body.sectorKey ?? '').trim();
    const familyKey = String(body.familyKey ?? '').trim();

    if (!isSectorKey(sectorKey)) {
      return NextResponse.json({ ok: false, error: 'Valid sectorKey is required.' }, { status: 400 });
    }

    if (!familyKey) {
      return NextResponse.json({ ok: false, error: 'familyKey is required.' }, { status: 400 });
    }

    const result = await findMarketVaultMatches({
      sectorKey: sectorKey as SectorKey,
      familyKey,
      brandSlug: String(body.brandSlug ?? '').trim() || null,
      typedModelName: String(body.typedModelName ?? '').trim() || null,
      specsJson: normalizeSpecsJson(body.specsJson),
      limit: Number(body.limit) || 12,
    });

    return NextResponse.json({ ok: true, strategy: result.strategy, count: result.matches.length, matches: result.matches });
  } catch (error) {
    console.error('market-vault matches route failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load market matches.' },
      { status: 500 },
    );
  }
}
