import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import type { CabType, DriveType, TractorCatalogRow, TractorType } from '../../../lib/tractor-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TractorCatalogDbRow = {
  id: string | number;
  brand_slug: string;
  brand_name: string;
  model_name: string;
  tractor_type: string;
  drive_type: string;
  cab_type: string;
  power_kw: number | string;
  year_start: number | string;
  year_end: number | string;
  aim4price_replacement_price_ex_vat: string | number | null;
};

function normalizeTractorType(value: unknown): TractorType {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'orchard' || normalized === 'vineyard') {
    return 'orchard';
  }

  return 'field';
}

function normalizeDriveType(value: unknown): DriveType {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  if (normalized === '2wd' || normalized === '2x4' || normalized === '2-wheel-drive') {
    return '2wd';
  }

  if (normalized === 'tracks' || normalized === 'track' || normalized === 'tracked') {
    return 'tracks';
  }

  return '4wd';
}

function normalizeCabType(value: unknown): CabType {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');

  if (normalized === 'open-station' || normalized === 'openstation' || normalized === 'open') {
    return 'open-station';
  }

  return 'cab';
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function mapTractorRow(row: TractorCatalogDbRow): TractorCatalogRow {
  const powerKw = toNumber(row.power_kw);
  const powerHp = Math.round(powerKw * 1.341);
  const replacement = toNumber(row.aim4price_replacement_price_ex_vat);

  return {
    id: String(row.id),
    title: `${row.brand_name} ${row.model_name}`,
    name: `${row.brand_name} ${row.model_name}`,
    brandName: row.brand_name,
    brandSlug: row.brand_slug,
    modelName: row.model_name,
    tractorType: normalizeTractorType(row.tractor_type),
    drive: normalizeDriveType(row.drive_type),
    cab: normalizeCabType(row.cab_type),
    powerKw,
    powerHp,
    horsepowerHp: powerHp,
    yearStart: toNumber(row.year_start),
    yearEnd: toNumber(row.year_end),
    startYear: toNumber(row.year_start),
    endYear: toNumber(row.year_end),
    aim4priceReplacementExVat: replacement,
    replacementPriceExVat: replacement,
    imageSrc: '/brand/Tractor.png',
  };
}

function isValidTractorType(value: string | null): value is TractorType {
  return value === 'field' || value === 'orchard';
}

function isValidDriveType(value: string | null): value is DriveType {
  return value === '2wd' || value === '4wd' || value === 'tracks';
}

function isValidCabType(value: string | null): value is CabType {
  return value === 'cab' || value === 'open-station';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const brandSlug = searchParams.get('brandSlug')?.trim() ?? '';
    const tractorType = searchParams.get('tractorType');
    const drive = searchParams.get('drive');
    const cab = searchParams.get('cab');

    if (!brandSlug) {
      return NextResponse.json(
        { ok: false, error: 'brandSlug is required' },
        { status: 400 },
      );
    }

    if (tractorType && !isValidTractorType(tractorType)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid tractorType' },
        { status: 400 },
      );
    }

    if (drive && !isValidDriveType(drive)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid drive' },
        { status: 400 },
      );
    }

    if (cab && !isValidCabType(cab)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid cab' },
        { status: 400 },
      );
    }

    const db = getDb();

    const values: Array<string> = [brandSlug];
    const conditions: string[] = [
      'b.slug = $1',
      'b.is_active = true',
      'tc.is_active = true',
    ];

    if (tractorType) {
      values.push(tractorType);
      conditions.push(`tc.tractor_type = $${values.length}`);
    }

    if (drive) {
      values.push(drive);
      conditions.push(`tc.drive_type = $${values.length}`);
    }

    if (cab) {
      values.push(cab);
      conditions.push(`tc.cab_type = $${values.length}`);
    }

    const result = await db.query<TractorCatalogDbRow>(
      `
        select
          tc.id,
          b.slug as brand_slug,
          b.name as brand_name,
          tc.model_name,
          tc.tractor_type,
          tc.drive_type,
          tc.cab_type,
          tc.power_kw,
          tc.year_start,
          tc.year_end,
          tc.aim4price_replacement_price_ex_vat
        from tractor_catalog tc
        inner join brands b
          on b.id = tc.brand_id
        where ${conditions.join('\n          and ')}
        order by
          tc.model_name asc,
          tc.year_start asc,
          tc.year_end asc,
          tc.id asc
      `,
      values,
    );

    const models = result.rows.map(mapTractorRow);

    return NextResponse.json({
      ok: true,
      count: models.length,
      models,
    });
  } catch (error) {
    console.error('tractor-models route failed', error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load tractor models',
      },
      { status: 500 },
    );
  }
}
