import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import type { CabType, DriveType, TractorCatalogRow, TractorType } from '../../../lib/tractor-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TractorCatalogDbRow = {
  id: string;
  brand_slug: string;
  brand_name: string;
  model_name: string;
  tractor_type: string;
  drive: string;
  cab: string;
  power_kw: number;
  year_start: number;
  year_end: number;
  aim4price_replacement_ex_vat: string | number;
};

function mapTractorRow(row: TractorCatalogDbRow): TractorCatalogRow {
  const powerHp = Math.round(Number(row.power_kw) * 1.341);
  const replacement = Number(row.aim4price_replacement_ex_vat);

  return {
    id: row.id,
    title: `${row.brand_name} ${row.model_name}`,
    name: `${row.brand_name} ${row.model_name}`,
    brandName: row.brand_name,
    brandSlug: row.brand_slug,
    modelName: row.model_name,
    tractorType: row.tractor_type as TractorType,
    drive: row.drive as DriveType,
    cab: row.cab as CabType,
    powerKw: Number(row.power_kw),
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
      return NextResponse.json(
        {
          ok: false,
          error: 'brandSlug is required',
        },
        { status: 400 }
      );
    }

    const db = getDb();

    const result = await db.query<TractorCatalogDbRow>(
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
          and ($2::text is null or tractor_type = $2)
          and ($3::text is null or drive = $3)
          and ($4::text is null or cab = $4)
        order by model_name asc
      `,
      [brandSlug, tractorType, drive, cab]
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
        error: 'Failed to load tractor models',
      },
      { status: 500 }
    );
  }
}
