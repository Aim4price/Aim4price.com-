import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { createAssetRegisterItemFromValuation } from '../../../lib/asset-register-db';
import { runServerValuation } from '../../../lib/server-valuation';
import {
  getSelectedMethodValue,
  saveValuationRunFromResult,
  type MethodKey,
  type SaveValuationRunInput,
  type SaveValuationRunResult,
} from '../../../lib/valuation-runs';
import type { ConditionKey } from '../../../lib/tractor-data';
import type { GpsType, RunValuationInput } from '../../../lib/tractor-logic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SaveValuationRunApiResponse = {
  ok: boolean;
  runId?: number;
  assetId?: number;
  createdAtIso?: string;
  selectedValueExVat?: number;
  warning?: string;
  error?: string;
};

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  if (typeof value === 'number') return value === 1;
  return false;
}

function normalizeCondition(value: unknown): ConditionKey | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (
    normalized === 'excellent' ||
    normalized === 'good' ||
    normalized === 'fair' ||
    normalized === 'used' ||
    normalized === 'serious'
  ) {
    return normalized;
  }

  return null;
}

function normalizeMethod(value: unknown): MethodKey | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'aim4price' || normalized === 'market' || normalized === 'department') {
    return normalized;
  }

  return null;
}

function normalizeGpsType(value: unknown): GpsType | null {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'full-autosteer' || normalized === 'guidance-only') {
    return normalized;
  }

  return null;
}

function buildInput(
  body: Partial<RunValuationInput> & { selectedMethod?: unknown; valuationVersion?: unknown },
): SaveValuationRunInput | null {
  const modelId = String(body.modelId ?? '').trim();
  const year = Number(body.year);
  const hours = Number(body.hours);
  const condition = normalizeCondition(body.condition);
  const selectedMethod = normalizeMethod(body.selectedMethod);

  if (!modelId || !Number.isFinite(year) || !Number.isFinite(hours) || !condition || !selectedMethod) {
    return null;
  }

  return {
    modelId,
    year,
    hours,
    condition,
    frontPto: parseBoolean(body.frontPto),
    frontLoader: parseBoolean(body.frontLoader),
    gpsEnabled: parseBoolean(body.gpsEnabled),
    gpsType: normalizeGpsType(body.gpsType),
    gpsYear: body.gpsYear ?? null,
    selectedMethod,
    valuationVersion: String(body.valuationVersion ?? 'v1').trim() || 'v1',
    userId: null,
  };
}

function badRequest(message: string) {
  return NextResponse.json<SaveValuationRunApiResponse>(
    {
      ok: false,
      error: message,
    },
    { status: 400 },
  );
}

function buildFriendlyError(error: unknown): { status: number; message: string } {
  if (error instanceof Error) {
    if (error.message === 'MODEL_NOT_FOUND') {
      return {
        status: 404,
        message: 'Selected tractor model was not found in the database.',
      };
    }

    if (error.message === 'SELECTED_METHOD_NOT_AVAILABLE') {
      return {
        status: 400,
        message: 'The selected valuation method is not available for this tractor profile.',
      };
    }

    return {
      status: 500,
      message: error.message || 'Failed to save to asset register.',
    };
  }

  return {
    status: 500,
    message: 'Failed to save to asset register.',
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json<SaveValuationRunApiResponse>(
        {
          ok: false,
          error: 'You must be signed in to save to your asset register.',
        },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Partial<RunValuationInput> & {
      selectedMethod?: unknown;
      valuationVersion?: unknown;
    };

    const input = buildInput(body);
    if (!input) {
      return badRequest('modelId, year, hours, condition and selectedMethod are required.');
    }

    const valuationResult = await runServerValuation(input);
    const selectedValueExVat = getSelectedMethodValue(valuationResult, input.selectedMethod);

    if (selectedValueExVat === null) {
      return NextResponse.json<SaveValuationRunApiResponse>(
        {
          ok: false,
          error: 'The selected valuation method is not available for this tractor profile.',
        },
        { status: 400 },
      );
    }

    let savedRun: SaveValuationRunResult | null = null;
    let warning: string | undefined;

    try {
      savedRun = await saveValuationRunFromResult(
        {
          ...input,
          userId: session.user.id,
        },
        valuationResult,
      );
    } catch (historyError) {
      if (
        historyError instanceof Error &&
        (historyError.message === 'MODEL_NOT_FOUND' || historyError.message === 'SELECTED_METHOD_NOT_AVAILABLE')
      ) {
        throw historyError;
      }

      console.error('valuation history save failed; continuing with asset register save', historyError);
      warning = 'Valuation history could not be stored, but the asset was saved successfully.';
    }

    const asset = await createAssetRegisterItemFromValuation({
      userId: session.user.id,
      valuationRunId: savedRun?.runId ?? null,
      result: valuationResult,
      selectedMethod: input.selectedMethod,
      selectedValueExVat,
      year: input.year,
      hours: input.hours,
      note: '',
    });

    return NextResponse.json<SaveValuationRunApiResponse>({
      ok: true,
      runId: savedRun?.runId,
      assetId: asset.id,
      createdAtIso: savedRun?.createdAtIso ?? asset.createdAtIso,
      selectedValueExVat,
      warning,
    });
  } catch (error) {
    console.error('valuation-runs route failed', error);

    const friendly = buildFriendlyError(error);

    return NextResponse.json<SaveValuationRunApiResponse>(
      {
        ok: false,
        error: friendly.message,
      },
      { status: friendly.status },
    );
  }
}
