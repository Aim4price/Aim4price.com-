import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import type { CabType, DriveType, TractorCatalogRow, TractorType } from '../../../lib/tractor-data';

type EquipmentModelDbRow = {
  id: string | number;
  legacy_tractor_catalog_id: string | number | null;
  brand_slug: string | null;
  brand_name: string | null;
  model_name: string;
  tractor_type: string | null;
  drive_type: string | null;
  cab_type: string | null;
  power_kw: number | string | null;
  year_start: number | string | null;
  year_end: number | string | null;
  aim4price_replacement_price_ex_vat: string | number | null;
  is_generic_fallback: boolean | string | number | null;
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTractorType(value: unknown): TractorType {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'orchard' || normalized === 'vineyard' ? 'orchard' : 'field';
}

function normalizeDriveType(value: unknown): DriveType {
  const normalized = normalizeText(value).toLowerCase().replace(/\s+/g, '');

  if (normalized === '2wd' || normalized === '2x4' || normalized === '2-wheel-drive') {
    return '2wd';
  }

  if (normalized === 'tracks' || normalized === 'track' || normalized === 'tracked') {
    return 'tracks';
  }

  return '4wd';
}

function normalizeCabType(value: unknown): CabType {
  const normalized = normalizeText(value).toLowerCase().replace(/[\s_]+/g, '-');
  return normalized === 'open-station' || normalized === 'openstation' || normalized === 'open'
    ? 'open-station'
    : 'cab';
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = normalizeText(value).toLowerCase();
  return ['true', 't', '1', 'yes'].includes(normalized);
}

function mapTractorRow(row: EquipmentModelDbRow): TractorCatalogRow {
  const powerKw = toNumber(row.power_kw);
  const powerHp = Math.round(powerKw * 1.341);
  const replacement = toNumber(row.aim4price_replacement_price_ex_vat);
  const brandName = normalizeText(row.brand_name);
  const modelName = normalizeText(row.model_name);

  return {
    id: String(row.id),
    title: `${brandName} ${modelName}`.trim(),
    name: `${brandName} ${modelName}`.trim(),
    brandName,
    brandSlug: normalizeText(row.brand_slug) || slugify(brandName),
    modelName,
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
      return NextResponse.json({ ok: false, error: 'brandSlug is required' }, { status: 400 });
    }

    if (tractorType && !isValidTractorType(tractorType)) {
      return NextResponse.json({ ok: false, error: 'Invalid tractorType' }, { status: 400 });
    }

    if (drive && !isValidDriveType(drive)) {
      return NextResponse.json({ ok: false, error: 'Invalid drive' }, { status: 400 });
    }

    if (cab && !isValidCabType(cab)) {
      return NextResponse.json({ ok: false, error: 'Invalid cab' }, { status: 400 });
    }

    const db = getDb();
    const values: string[] = [brandSlug];
    const conditions: string[] = [
      `s.sector_key = 'agricultural'`,
      `ef.family_key = 'tractors'`,
      'b.slug = $1',
      'b.is_active = true',
      'em.is_active = true',
      'coalesce(em.is_generic_fallback, false) = false',
    ];

    if (tractorType) {
      values.push(tractorType);
      conditions.push(`em.tractor_type = $${values.length}`);
    }

    if (drive) {
      values.push(drive);
      conditions.push(`em.drive_type = $${values.length}`);
    }

    if (cab) {
      values.push(cab);
      conditions.push(`em.cab_type = $${values.length}`);
    }

    const result = await db.query<EquipmentModelDbRow>(
      `
        select
          em.id,
          em.legacy_tractor_catalog_id,
          b.slug as brand_slug,
          b.name as brand_name,
          em.model_name,
          em.tractor_type,
          em.drive_type,
          em.cab_type,
          em.power_kw,
          em.year_start,
          em.year_end,
          em.aim4price_replacement_price_ex_vat,
          em.is_generic_fallback
        from public.equipment_models em
        inner join public.equipment_families ef
          on ef.id = em.equipment_family_id
        inner join public.sectors s
          on s.id = ef.sector_id
        inner join public.brands b
          on b.id = em.brand_id
        where ${conditions.join(' and ')}
        order by
          em.model_name asc,
          em.year_start asc nulls last,
          em.year_end asc nulls last,
          em.id asc
      `,
      values,
    );

    const models = result.rows
      .filter((row) => !toBoolean(row.is_generic_fallback))
      .map(mapTractorRow);

    return NextResponse.json({ ok: true, count: models.length, models });
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
