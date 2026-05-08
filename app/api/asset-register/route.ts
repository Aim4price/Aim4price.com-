import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import {
  deleteUnreferencedAssetRegisterUploads,
  listInternalAssetRegisterUploadIds,
  MAX_ASSET_REGISTER_PHOTOS,
  MAX_ASSET_REGISTER_DOCUMENTS,
} from '../../../lib/asset-register-uploads';
import {
  createManualAssetRegisterItem,
  deleteAssetRegisterItem,
  getAssetRegisterItemById,
  listAssetRegisterItems,
  updateAssetRegisterItem,
  type AssetRegisterDocument,
  type AssetRegisterItemKind,
  type CreateManualAssetInput,
  type UpdateAssetRegisterItemInput,
} from '../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function normalizeHours(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const numeric = Number(text);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.round(numeric);
}

function normalizeYearModel(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const year = Math.round(numeric);
  if (year < 1800 || year > new Date().getFullYear() + 1) {
    return null;
  }

  return year;
}

function normalizeUsageMetric(value: unknown): 'hours' | 'km' | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') {
    return 'km';
  }

  if (normalized === 'hours' || normalized === 'hour' || normalized === 'hrs') {
    return 'hours';
  }

  return null;
}

function normalizeLifeWorkedPercent(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    return null;
  }

  return Math.round(numeric * 10) / 10;
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

function normalizeSpecsJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function buildManualSpecsJson(
  value: unknown,
  usageMetric: 'hours' | 'km' | null,
  lifeWorkedPercent: number | null,
): Record<string, unknown> {
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
  if (normalized === 'serious' || normalized === 'requires attention' || normalized === 'requires serious attention') {
    return 'serious';
  }

  if (normalized === 'good') return 'good';
  return null;
}

function normalizePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }

      seen.add(entry);
      return true;
    })
    .slice(0, MAX_ASSET_REGISTER_PHOTOS);
}


function normalizeDocuments(value: unknown): AssetRegisterDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const documents: AssetRegisterDocument[] = [];

  value.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return;
    }

    const record = entry as Record<string, unknown>;
    const url = String(record.url ?? '').trim();
    const fileName = String(record.fileName ?? record.name ?? '').trim();

    if (!url) {
      return;
    }

    const document: AssetRegisterDocument = {
      id: String(record.id ?? record.uploadId ?? url).trim() || url,
      url,
      fileName: fileName || `Document ${index + 1}`,
      contentType: String(record.contentType ?? record.mimeType ?? 'application/octet-stream').trim() || 'application/octet-stream',
      byteSize: Math.max(0, Math.round(Number(record.byteSize ?? record.sizeBytes ?? 0) || 0)),
      uploadedAtIso: String(record.uploadedAtIso ?? record.uploadedAt ?? '').trim() || new Date().toISOString(),
    };

    const duplicateKey = document.url || document.id;
    if (seen.has(duplicateKey)) {
      return;
    }

    seen.add(duplicateKey);
    documents.push(document);
  });

  return documents.slice(0, MAX_ASSET_REGISTER_DOCUMENTS);
}

function documentUrls(documents: AssetRegisterDocument[]): string[] {
  return documents.map((document) => String(document.url ?? '').trim()).filter(Boolean);
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

  if (typeof error === 'object' && error !== null) {
    const details = error as ErrorLike;
    const parts = [
      typeof details.message === 'string' ? details.message : '',
      typeof details.detail === 'string' ? details.detail : '',
      typeof details.hint === 'string' ? `hint: ${details.hint}` : '',
      typeof details.column === 'string' ? `column: ${details.column}` : '',
      typeof details.table === 'string' ? `table: ${details.table}` : '',
      typeof details.constraint === 'string' ? `constraint: ${details.constraint}` : '',
      typeof details.code === 'string' ? `code: ${details.code}` : '',
    ].filter(Boolean);

    if (parts.length) {
      return parts.join(' | ');
    }
  }

  return fallback;
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const items = await listAssetRegisterItems(session.user.id);

    return NextResponse.json({
      ok: true,
      items,
      summary: {
        count: items.length,
        totalValue: items.reduce((sum, item) => sum + Number(item.value || 0), 0),
      },
    });
  } catch (error) {
    console.error('asset register GET failed', error);
    return NextResponse.json(
      { ok: false, error: formatUnknownError(error, 'Failed to load asset register.') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = (await request.json()) as Partial<CreateManualAssetInput>;
  const title = String(body.title ?? '').trim();
  const value = Math.round(Number(body.value) || 0);
  const usageMetric = normalizeUsageMetric(body.usageMetric);
  const lifeWorkedPercent = normalizeLifeWorkedPercent((body as { lifeWorkedPercent?: unknown }).lifeWorkedPercent);

  if (!title || value <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'title and value are required.',
      },
      { status: 400 },
    );
  }

  try {
    const item = await createManualAssetRegisterItem(session.user.id, {
      kind: normalizeKind(body.kind),
      title,
      value,
      note: body.note ?? null,
      serialNumber: body.serialNumber ?? null,
      isFinanced: Boolean(body.isFinanced),
      isInsured: Boolean(body.isInsured),
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

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error('asset register POST failed', error);
    return NextResponse.json(
      { ok: false, error: formatUnknownError(error, 'Failed to create asset.') },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = (await request.json()) as Partial<UpdateAssetRegisterItemInput>;
  const assetId = String(body.assetId ?? '').trim();
  const title = String(body.title ?? '').trim();
  const value = Math.round(Number(body.value) || 0);
  const usageMetric = normalizeUsageMetric(body.usageMetric);
  const lifeWorkedPercent = normalizeLifeWorkedPercent((body as { lifeWorkedPercent?: unknown }).lifeWorkedPercent);

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  if (!title || value <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'title and value are required.',
      },
      { status: 400 },
    );
  }

  const existing = await getAssetRegisterItemById(session.user.id, assetId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const nextPhotos = normalizePhotos(body.photos);
  const nextDocuments = normalizeDocuments(body.documents);
  const nextDocumentUrls = documentUrls(nextDocuments);
  const removedUploadIds = listInternalAssetRegisterUploadIds([
    ...existing.photos.filter((photo) => !nextPhotos.includes(photo)),
    ...documentUrls(existing.documents).filter((documentUrl) => !nextDocumentUrls.includes(documentUrl)),
  ]);

  try {
    const item = await updateAssetRegisterItem(session.user.id, {
      assetId,
      kind: normalizeKind(body.kind),
      title,
      value,
      note: body.note ?? null,
      serialNumber: body.serialNumber ?? null,
      isFinanced: Boolean(body.isFinanced),
      isInsured: Boolean(body.isInsured),
      financeNote: body.financeNote ?? null,
      photos: nextPhotos,
      documents: nextDocuments,
      yearModel: normalizeYearModel(body.yearModel),
      hours: normalizeHours(body.hours),
      usageMetric,
      lifeWorkedPercent,
      specsJson: buildManualSpecsJson(body.specsJson, usageMetric, lifeWorkedPercent),
      condition: normalizeCondition(body.condition),
    });

    await deleteUnreferencedAssetRegisterUploads({
      userId: session.user.id,
      uploadIds: removedUploadIds,
      excludeAssetId: assetId,
    });

    return NextResponse.json({ ok: true, item });
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

    console.error('asset register PUT failed', error);
    return NextResponse.json(
      { ok: false, error: formatUnknownError(error, 'Failed to update asset.') },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const assetId = String(searchParams.get('id') ?? '').trim();

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'Valid asset id is required.' }, { status: 400 });
  }

  const existing = await getAssetRegisterItemById(session.user.id, assetId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
  }

  const uploadIds = listInternalAssetRegisterUploadIds([...existing.photos, ...documentUrls(existing.documents)]);

  try {
    await deleteAssetRegisterItem(session.user.id, assetId);
  } catch (error) {
    console.error('asset register delete failed', error);
    return NextResponse.json(
      { ok: false, error: formatUnknownError(error, 'Failed to delete asset.') },
      { status: 500 },
    );
  }

  try {
    await deleteUnreferencedAssetRegisterUploads({
      userId: session.user.id,
      uploadIds,
      excludeAssetId: assetId,
    });
  } catch (error) {
    console.error('asset register upload cleanup failed after delete', error);
  }

  return NextResponse.json({ ok: true });
}
