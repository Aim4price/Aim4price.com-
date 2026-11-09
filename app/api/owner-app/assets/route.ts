import { NextRequest, NextResponse } from 'next/server';
import {
  createManualAssetRegisterItem,
  type AssetRegisterItemKind,
  type CreateManualAssetInput,
} from '../../../../lib/asset-register-db';
import { buildAppAssetDirectoryGroups } from '../../../../lib/app-asset-directory';
import { listAssetGroups } from '../../../../lib/asset-groups';
import { getOwnerAppAccess, ownerAppCan } from '../../../../lib/owner-app-access';
import { filterOwnerAppAssets, listAllOwnerAppAssets } from '../../../../lib/owner-app-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = new Set<AssetRegisterItemKind>([
  'tractor',
  'equipment',
  'manual',
  'property',
  'vehicle',
  'tools',
  'stock',
]);

const CONDITIONS = new Set(['excellent', 'good', 'fair', 'used', 'serious']);

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: 'You must sign in to Aim4price Owner.' },
    { status: 401 },
  );
}

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function positiveNumber(value: unknown): number | null {
  const normalized = typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function nonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || text(value) === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function yearModel(value: unknown): number | null {
  const parsed = nonNegativeNumber(value);
  if (parsed === null) return null;
  return parsed >= 1800 && parsed <= new Date().getFullYear() + 1 ? parsed : null;
}

function kind(value: unknown): AssetRegisterItemKind {
  const normalized = text(value).toLowerCase() as AssetRegisterItemKind;
  return KINDS.has(normalized) ? normalized : 'manual';
}

function condition(value: unknown): CreateManualAssetInput['condition'] {
  const normalized = text(value).toLowerCase();
  return CONDITIONS.has(normalized) ? normalized as CreateManualAssetInput['condition'] : null;
}

export async function GET(request: NextRequest) {
  const access = await getOwnerAppAccess();
  if (!access) return unauthorized();

  try {
    const [{ registers, items }, assetGroups] = await Promise.all([
      listAllOwnerAppAssets(access.ownerUserId),
      listAssetGroups(access.ownerUserId),
    ]);
    const visibleItems = access.assetScope === 'all'
      ? items
      : items.filter((item) => access.accessibleAssetIds.includes(item.id));
    const query = request.nextUrl.searchParams.get('q') ?? '';
    return NextResponse.json({
      ok: true,
      registers,
      items: filterOwnerAppAssets(visibleItems, query),
      groups: buildAppAssetDirectoryGroups(assetGroups, visibleItems.map((item) => item.id)),
    });
  } catch (error) {
    console.error('Owner App assets GET failed.', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to load your assets.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await getOwnerAppAccess();
  if (!access) return unauthorized();
  if (!ownerAppCan(access, 'manage_assets')) return NextResponse.json({ ok: false, error: 'Only an Owner / Admin login can add assets.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid asset details.' }, { status: 400 });
  }

  const title = text(body.title);
  const value = positiveNumber(body.value);
  const replacementPriceExVat = positiveNumber(body.replacementPriceExVat);
  const assetKind = kind(body.kind);
  const propertyAssetSubtype = text(body.propertyAssetSubtype).toLowerCase();
  const replacementNotApplicable = assetKind === 'stock' || (assetKind === 'property' && propertyAssetSubtype === 'land');
  const usageMetric = text(body.usageMetric).toLowerCase() || 'hours';
  if (!['hours', 'km', 'percentage', 'not_applicable'].includes(usageMetric)) {
    return NextResponse.json({ ok: false, error: 'Choose a valid usage type.' }, { status: 400 });
  }
  const requestedYearModel = text(body.yearModel);
  const normalizedYearModel = yearModel(body.yearModel);
  const requestedHours = text(body.hours);
  const hours = nonNegativeNumber(body.hours);
  const percentage = requestedHours ? Number(body.hours) : null;

  if (!title || value === null || (!replacementNotApplicable && replacementPriceExVat === null)) {
    return NextResponse.json(
      { ok: false, error: replacementNotApplicable ? 'Asset name and current value are required.' : 'Asset name, current value and replacement price are required.' },
      { status: 400 },
    );
  }
  if (requestedYearModel && normalizedYearModel === null) {
    return NextResponse.json({ ok: false, error: 'Enter a valid year model.' }, { status: 400 });
  }
  if (usageMetric !== 'not_applicable' && requestedHours && hours === null) {
    return NextResponse.json({ ok: false, error: 'Enter a valid, non-negative usage reading.' }, { status: 400 });
  }

  if (usageMetric === 'percentage' && (percentage === null || !Number.isFinite(percentage) || percentage < 0 || percentage > 100)) {
    return NextResponse.json({ ok: false, error: 'Percentage worked must be between 0 and 100.' }, { status: 400 });
  }

  try {
    const item = await createManualAssetRegisterItem(access.ownerUserId, {
      registerId: text(body.registerId) || null,
      kind: assetKind,
      title,
      value,
      replacementPriceExVat,
      note: text(body.note) || null,
      serialNumber: text(body.serialNumber) || null,
      brandName: text(body.brandName) || null,
      modelName: text(body.modelName) || null,
      isFinanced: false,
      isInsured: false,
      insuredValueExVat: null,
      isLicensed: false,
      licenseRegistrationNumber: null,
      financeNote: null,
      photos: [],
      documents: [],
      yearModel: normalizedYearModel,
      hours: usageMetric === 'hours' || usageMetric === 'km' ? hours : null,
      usageMetric: usageMetric === 'hours' || usageMetric === 'km' ? usageMetric : null,
      lifeWorkedPercent: usageMetric === 'percentage' ? percentage : null,
      specsJson: {
        ...(assetKind === 'property' && ['land', 'building'].includes(propertyAssetSubtype) ? { propertyAssetSubtype } : {}),
        usageTypeConfirmed: true,
        usageApplicable: usageMetric !== 'not_applicable',
        usage_applicable: usageMetric !== 'not_applicable',
        usageMetric,
        usage_metric: usageMetric,
        selectedUsageMode: usageMetric,
        selected_usage_mode: usageMetric,
      },
      condition: condition(body.condition),
    });

    return NextResponse.json({
      ok: true,
      item,
      redirectTo: `/owner-app/assets/${encodeURIComponent(item.id)}`,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'ASSET_REGISTER_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset register not found.' }, { status: 404 });
    }
    if (code === 'REPLACEMENT_PRICE_REQUIRED') {
      return NextResponse.json(
        { ok: false, error: 'Replacement price is required and must be greater than zero.' },
        { status: 400 },
      );
    }
    console.error('Owner App assets POST failed.', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to create the asset.' },
      { status: 500 },
    );
  }
}
