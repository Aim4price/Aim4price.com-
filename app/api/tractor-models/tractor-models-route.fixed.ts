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
  drive: string;
  cab: string;
  power_kw: number | string;
  year_start: number | string;
  year_end: number | string;
  aim4price_replacement_ex_vat: string | number | null;
};

function normalizeTractorType(value: string): TractorType {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'orchard' || normalized === 'vineyard') {
    return 'orchard';
  }

  return 'field';
}

function normalizeDrive(value: string): DriveType {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');

  if (normalized === '2wd' || normalized === '2x4') return '2wd';
  if (normalized === '4wd' || normalized === '4x4' || normalized === 'mfwd') return '4wd';
  if (normalized === 'tracks' || normalized === 'track' || normalized === 'tracked') return 'tracks';

  return normalized as DriveType;
}

function normalizeCab(value: string): CabType {
  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, '-');

  if (normalized === 'open-station' || normalized === 'openstation') return 'open-station';
  return 'cab';
}

function mapTractorRow(row: TractorCatalogDbRow): TractorCatalogRow {
  const powerKw = Number(row.power_kw);
  const powerHp = Math.round(powerKw * 1.341);
  const replacement = Number(row.aim4price_replacement_ex_vat ?? 0);

  return {
    id: String(row.id),
    title: `${row.brand_name} ${row.model_name}`,
    name: `${row.brand_name} ${row.model_name}`,
    brandName: row.brand_name,
    brandSlug: row.brand_slug,
    modelName: row.model_name,
    tractorType: normalizeTractorType(row.tractor_type),
    drive: normalizeDrive(row.drive),
    cab: normalizeCab(row.cab),
    powerKw,
    powerHp,
    horsepowerHp: powerHp,
    yearStart: Number(row.year_start),
    yearEnd: Number(row.year_end),
    startYear: Number(row.year_start),
    endYear: Number(row.year_end),
    aim4priceReplacementExVat: replacement,
    replacementPriceExVat: replacement,
    departmentReplacementExVat: replacement,
    imageSrc: '/brand/Tractor.png',
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const brandSlug = searchParams.get('brandSlug');
    const tractorType = searchParams.get('tractorType');
    const drive = searchParams.get('drive');
    const cab = searchParams.get('cab');

    if (!brandSlug) {
      return NextResponse.json({ ok: false, error: 'brandSlug is required' }, { status: 400 });
    }

    const db = getDb();

    const columnsResult = await db.query<{ column_name: string }>(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'tractor_catalog'
    `);

    const columns = new Set(columnsResult.rows.map((row) => row.column_name));

    const hasCurrentShape =
      columns.has('brand_slug') &&
      columns.has('brand_name') &&
      columns.has('drive') &&
      columns.has('cab') &&
      columns.has('aim4price_replacement_ex_vat');

    const hasBrandIdShape =
      columns.has('brand_id') &&
      columns.has('drive_type') &&
      columns.has('cab_type') &&
      columns.has('aim4price_replacement_price_ex_vat');

    let result;

    if (hasCurrentShape) {
      result = await db.query<TractorCatalogDbRow>(
        `
          select
            id,
            brand_slug,
            brand_name,
            model_name,
            tractor_type,
            drive,
            cab,
            power_kw,
            year_start,
            year_end,
            aim4price_replacement_ex_vat
          from tractor_catalog
          where brand_slug = $1
          order by model_name asc
        `,
        [brandSlug],
      );
    } else if (hasBrandIdShape) {
      result = await db.query<TractorCatalogDbRow>(
        `
          select
            tc.id::text as id,
            b.slug as brand_slug,
            b.name as brand_name,
            tc.model_name,
            tc.tractor_type,
            tc.drive_type as drive,
            tc.cab_type as cab,
            tc.power_kw,
            tc.year_start,
            tc.year_end,
            tc.aim4price_replacement_price_ex_vat as aim4price_replacement_ex_vat
          from tractor_catalog tc
          inner join brands b on b.id = tc.brand_id
          where b.slug = $1
          order by tc.model_name asc
        `,
        [brandSlug],
      );
    } else {
      throw new Error(
        `Unsupported tractor_catalog shape. Columns found: ${Array.from(columns).sort().join(', ')}`,
      );
    }

    const models = result.rows
      .map(mapTractorRow)
      .filter((row) => !tractorType || row.tractorType === tractorType)
      .filter((row) => !drive || row.drive === drive)
      .filter((row) => !cab || row.cab === cab);

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
