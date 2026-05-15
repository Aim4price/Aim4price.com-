import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile, type AccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import {
  canViewOwnerRegister,
  createSharedAssetNote,
  listSharedRegisterAssets,
  normalizePartnerType,
} from '../../../../../lib/partner-access';
import {
  getAssetRegisterItemById,
  updateAssetRegisterItem,
  type AssetRegisterDocument,
  type AssetRegisterItem,
  type AssetRegisterItemKind,
  type UpdateAssetRegisterItemInput,
} from '../../../../../lib/asset-register-db';
import {
  MAX_ASSET_REGISTER_DOCUMENTS,
  MAX_ASSET_REGISTER_PHOTOS,
} from '../../../../../lib/asset-register-uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    ownerUserId: string;
  };
};

type ErrorLike = {
  message?: unknown;
  detail?: unknown;
  hint?: unknown;
  code?: unknown;
  table?: unknown;
  column?: unknown;
  constraint?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function normalizeKind(value: unknown): AssetRegisterItemKind {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'tractor') return 'tractor';
  if (normalized === 'equipment' || normalized === 'valued equipment') return 'equipment';
  if (normalized === 'property') return 'property';
  if (normalized === 'vehicle') return 'vehicle';
  if (normalized === 'tool' || normalized === 'tools') return 'tools';
  return 'manual';
}

function normalizeLicenseRegistrationNumber(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function normalizeHours(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null;
  const text = String(value).trim();
  if (!text) return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric);
}

function normalizeYearModel(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null;
  const text = String(value).trim();
  if (!text) return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return null;
  const year = Math.round(numeric);
  if (year < 1800 || year > new Date().getFullYear() + 1) return null;
  return year;
}

function normalizeUsageMetric(value: unknown): 'hours' | 'km' | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') return 'km';
  if (normalized === 'hours' || normalized === 'hour' || normalized === 'hrs') return 'hours';
  return null;
}

function normalizeLifeWorkedPercent(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) return null;
  return Math.round(numeric * 10) / 10;
}

function normalizeSpecsJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readLifeWorkedPercentFromSpecs(specs: Record<string, unknown>): number | null {
  return (
    normalizeLifeWorkedPercent(specs.life_worked_percent) ??
    normalizeLifeWorkedPercent(specs.worked_percent) ??
    normalizeLifeWorkedPercent(specs.lifetime_worked_percent) ??
    normalizeLifeWorkedPercent(specs.percent_worked) ??
    normalizeLifeWorkedPercent(specs.lifetime_used_percent)
  );
}

function buildManualSpecsJson(value: unknown, usageMetric: 'hours' | 'km' | null, lifeWorkedPercent: number | null): Record<string, unknown> {
  const specs = normalizeSpecsJson(value);
  const resolvedLifeWorkedPercent = lifeWorkedPercent ?? readLifeWorkedPercentFromSpecs(specs);

  return {
    ...specs,
    ...(usageMetric
      ? {
          usageMetric,
          usage_metric: usageMetric,
          usage_unit: usageMetric,
        }
      : {}),
    ...(resolvedLifeWorkedPercent !== null
      ? {
          life_worked_percent: resolvedLifeWorkedPercent,
          worked_percent: resolvedLifeWorkedPercent,
          percent_worked: resolvedLifeWorkedPercent,
          lifetime_worked_percent: resolvedLifeWorkedPercent,
        }
      : {}),
  };
}

function normalizeCondition(value: unknown): UpdateAssetRegisterItemInput['condition'] {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'excellent') return 'excellent';
  if (normalized === 'fair') return 'fair';
  if (normalized === 'used') return 'used';
  if (normalized === 'serious' || normalized === 'requires attention' || normalized === 'requires serious attention') return 'serious';
  if (normalized === 'good') return 'good';
  return null;
}

function normalizePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    })
    .slice(0, MAX_ASSET_REGISTER_PHOTOS);
}

function normalizeDocuments(value: unknown): AssetRegisterDocument[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const documents: AssetRegisterDocument[] = [];

  value.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return;
    const record = entry as Record<string, unknown>;
    const url = String(record.url ?? '').trim();
    const fileName = String(record.fileName ?? record.name ?? '').trim();

    if (!url) return;

    const document: AssetRegisterDocument = {
      id: String(record.id ?? record.uploadId ?? url).trim() || url,
      url,
      fileName: fileName || `Document ${index + 1}`,
      contentType: String(record.contentType ?? record.mimeType ?? 'application/octet-stream').trim() || 'application/octet-stream',
      byteSize: Math.max(0, Math.round(Number(record.byteSize ?? record.sizeBytes ?? 0) || 0)),
      uploadedAtIso: String(record.uploadedAtIso ?? record.uploadedAt ?? '').trim() || new Date().toISOString(),
    };

    const duplicateKey = document.url || document.id;
    if (seen.has(duplicateKey)) return;

    seen.add(duplicateKey);
    documents.push(document);
  });

  return documents.slice(0, MAX_ASSET_REGISTER_DOCUMENTS);
}

function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    const details = error as ErrorLike;
    return [
      error.message,
      typeof details.detail === 'string' ? details.detail : '',
      typeof details.hint === 'string' ? `hint: ${details.hint}` : '',
      typeof details.column === 'string' ? `column: ${details.column}` : '',
      typeof details.table === 'string' ? `table: ${details.table}` : '',
      typeof details.constraint === 'string' ? `constraint: ${details.constraint}` : '',
      typeof details.code === 'string' ? `code: ${details.code}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
  }

  return fallback;
}

function shortValue(value: unknown): string {
  if (value === null || typeof value === 'undefined' || value === '') return 'blank';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).trim() || 'blank';
}

function changed(label: string, before: unknown, after: unknown): string | null {
  const beforeText = shortValue(before);
  const afterText = shortValue(after);
  return beforeText === afterText ? null : `${label}: ${beforeText} → ${afterText}`;
}

function describeAssetChanges(before: AssetRegisterItem, after: AssetRegisterItem): string[] {
  return [
    changed('Title', before.title, after.title),
    changed('Value', before.value, after.value),
    changed('Year', before.yearModel, after.yearModel),
    changed('Usage', before.hours, after.hours),
    changed('Condition', before.condition, after.condition),
    changed('Serial number', before.serialNumber, after.serialNumber),
    changed('Financed', before.isFinanced, after.isFinanced),
    changed('Insured', before.isInsured, after.isInsured),
    changed('Licensed', before.isLicensed, after.isLicensed),
    changed('Registration', before.licenseRegistrationNumber, after.licenseRegistrationNumber),
    changed('Finance note', before.financeNote, after.financeNote),
    changed('Photos', before.photos.length, after.photos.length),
    changed('Documents', before.documents.length, after.documents.length),
  ].filter((entry): entry is string => Boolean(entry));
}

function partnerLabel(profile: AccountProfile): string {
  return profile.businessName || profile.displayName || profile.name || 'Aim4price partner';
}

async function getOwnerProfile(ownerUserId: string) {
  return getAccountProfile({ id: ownerUserId });
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const ownerUserId = decodeURIComponent(context.params.ownerUserId || '').trim();
    const assets = await listSharedRegisterAssets({
      currentUserId: session.user.id,
      ownerUserId,
    });
    const profile = await getOwnerProfile(ownerUserId);

    return NextResponse.json({
      ok: true,
      assets,
      items: assets,
      profile,
      summary: {
        count: assets.length,
        totalValue: assets.reduce((sum, asset) => sum + Number(asset.value || 0), 0),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'SHARED_REGISTER_FORBIDDEN') {
      return NextResponse.json({ ok: false, error: 'You do not have access to this register.' }, { status: 403 });
    }

    console.error('shared register assets GET failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to load shared register assets.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let body: Partial<UpdateAssetRegisterItemInput>;
  try {
    body = (await request.json()) as Partial<UpdateAssetRegisterItemInput>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid asset update.' }, { status: 400 });
  }

  const ownerUserId = decodeURIComponent(context.params.ownerUserId || '').trim();
  const assetId = String(body.assetId ?? '').trim();
  const title = String(body.title ?? '').trim();
  const value = Math.round(Number(body.value) || 0);
  const usageMetric = normalizeUsageMetric(body.usageMetric);
  const licenseRegistrationNumber = Boolean(body.isLicensed)
    ? normalizeLicenseRegistrationNumber((body as { licenseRegistrationNumber?: unknown }).licenseRegistrationNumber)
    : null;
  const lifeWorkedPercent = normalizeLifeWorkedPercent((body as { lifeWorkedPercent?: unknown }).lifeWorkedPercent);

  if (!ownerUserId || !assetId) {
    return NextResponse.json({ ok: false, error: 'Valid owner and asset ids are required.' }, { status: 400 });
  }

  if (!title || value <= 0) {
    return NextResponse.json({ ok: false, error: 'title and value are required.' }, { status: 400 });
  }

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    if (!normalizePartnerType(profile.accountType) || ownerUserId === session.user.id) {
      return NextResponse.json({ ok: false, error: 'Only shared partner accounts can update a shared owner asset.' }, { status: 403 });
    }

    const canView = await canViewOwnerRegister(session.user.id, ownerUserId);
    if (!canView) {
      return NextResponse.json({ ok: false, error: 'You do not have access to this register.' }, { status: 403 });
    }

    const existing = await getAssetRegisterItemById(ownerUserId, assetId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    const item = await updateAssetRegisterItem(ownerUserId, {
      assetId,
      kind: normalizeKind(body.kind),
      title,
      value,
      note: body.note ?? null,
      serialNumber: body.serialNumber ?? null,
      isFinanced: Boolean(body.isFinanced),
      isInsured: Boolean(body.isInsured),
      isLicensed: Boolean(body.isLicensed),
      licenseRegistrationNumber,
      financeNote: body.financeNote ?? null,
      photos: normalizePhotos(body.photos),
      documents: normalizeDocuments(body.documents),
      yearModel: normalizeYearModel(body.yearModel),
      hours: normalizeHours(body.hours),
      usageMetric,
      lifeWorkedPercent,
      specsJson: buildManualSpecsJson(body.specsJson, usageMetric, lifeWorkedPercent),
      condition: normalizeCondition(body.condition),
    });

    const changes = describeAssetChanges(existing, item);
    const noteText = [
      `Asset updated by ${partnerLabel(profile)}.`,
      changes.length ? changes.slice(0, 8).join('\n') : 'Asset details were updated.',
    ].join('\n');

    const note = await createSharedAssetNote({
      currentUserId: session.user.id,
      ownerUserId,
      assetId,
      noteText,
    });

    return NextResponse.json({ ok: true, item: { ...item, openPartnerNote: note }, note });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'USAGE_READING_CANNOT_DECREASE') {
      return NextResponse.json({ ok: false, error: 'The new usage reading cannot be lower than the reading already saved on this asset.' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'LIFE_WORKED_PERCENT_CANNOT_DECREASE') {
      return NextResponse.json({ ok: false, error: 'The new lifetime worked percentage cannot be lower than the percentage already saved on this asset.' }, { status: 400 });
    }

    if (error instanceof Error && (error.message === 'PARTNER_NOTE_FORBIDDEN' || error.message === 'SHARED_REGISTER_FORBIDDEN')) {
      return NextResponse.json({ ok: false, error: 'You do not have access to update this shared asset.' }, { status: 403 });
    }

    console.error('shared register asset PUT failed', error);
    return NextResponse.json({ ok: false, error: formatUnknownError(error, 'Failed to update shared asset.') }, { status: 500 });
  }
}
