import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { revalueAssetRegisterItem } from '../../../../lib/asset-register-revaluation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RevalueAssetResponse = {
  ok: boolean;
  item?: unknown;
  valuationRunId?: number;
  selectedMethod?: string;
  oldValueExVat?: number;
  newValueExVat?: number;
  warning?: string;
  error?: string;
};

function badRequest(message: string) {
  return NextResponse.json<RevalueAssetResponse>({ ok: false, error: message }, { status: 400 });
}

function formatError(error: unknown): { status: number; message: string } {
  if (error instanceof Error) {
    if (error.message === 'ASSET_NOT_FOUND') {
      return { status: 404, message: 'Asset not found.' };
    }

    if (error.message === 'ASSET_NOT_REVALUEABLE') {
      return {
        status: 400,
        message: 'This asset was saved as a manual asset. It needs an Aim4price valuation before the estimate can be updated automatically.',
      };
    }

    if (error.message === 'VALUATION_RUN_NOT_FOUND') {
      return {
        status: 404,
        message: 'The original valuation run could not be found for this asset.',
      };
    }

    if (error.message === 'MODEL_NOT_FOUND') {
      return {
        status: 404,
        message: 'The linked model could not be found in the current equipment database.',
      };
    }

    if (error.message === 'SELECTED_METHOD_NOT_AVAILABLE') {
      return {
        status: 400,
        message: 'The selected valuation method is not available for the latest asset details.',
      };
    }

    if (error.message.startsWith('This asset is missing') || error.message.startsWith('This tractor is missing')) {
      return { status: 400, message: error.message };
    }

    if (error.message === 'No valuation method is available for this asset right now.') {
      return { status: 400, message: error.message };
    }

    return { status: 500, message: error.message || 'Failed to update estimate.' };
  }

  return { status: 500, message: 'Failed to update estimate.' };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json<RevalueAssetResponse>({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }

  let body: { assetId?: unknown; selectedMethod?: unknown };
  try {
    body = (await request.json()) as { assetId?: unknown; selectedMethod?: unknown };
  } catch {
    return badRequest('Enter a valid estimate update request.');
  }

  const assetId = String(body.assetId ?? '').trim();

  if (!assetId) {
    return badRequest('Valid asset id is required.');
  }

  try {
    const result = await revalueAssetRegisterItem({
      userId: session.user.id,
      assetId,
      selectedMethod: body.selectedMethod,
    });

    return NextResponse.json<RevalueAssetResponse>({
      ok: true,
      item: result.item,
      valuationRunId: result.valuationRunId,
      selectedMethod: result.selectedMethod,
      oldValueExVat: result.oldValueExVat,
      newValueExVat: result.newValueExVat,
      warning: result.warning,
    });
  } catch (error) {
    console.error('asset register revalue failed', error);
    const formatted = formatError(error);
    return NextResponse.json<RevalueAssetResponse>({ ok: false, error: formatted.message }, { status: formatted.status });
  }
}
