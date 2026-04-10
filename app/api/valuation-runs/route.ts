import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { saveValuationRun, type MethodKey, type SaveValuationRunInput } from '../../../lib/valuation-runs';
import type { ConditionKey } from '../../../lib/tractor-data';
import type { GpsType, RunValuationInput } from '../../../lib/tractor-logic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SaveValuationRunApiResponse = {
  ok: boolean;
  runId?: number;
  createdAtIso?: string;
  selectedValueExVat?: number;
  error?: string;
};

function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    const body = (await request.json()) as Partial<RunValuationInput> & {
      selectedMethod?: unknown;
      valuationVersion?: unknown;
    };

    const input = buildInput(body);
    if (!input) {
      return badRequest('modelId, year, hours, condition and selectedMethod are required.');
    }

    const saved = await saveValuationRun({
      ...input,
      userId: session?.user?.id ?? null,
    });

    return NextResponse.json<SaveValuationRunApiResponse>({
      ok: true,
      runId: saved.runId,
      createdAtIso: saved.createdAtIso,
      selectedValueExVat: saved.selectedValueExVat,
    });
  } catch (error) {
    console.error('valuation-runs route failed', error);

    if (error instanceof Error) {
      if (error.message === 'MODEL_NOT_FOUND') {
        return NextResponse.json<SaveValuationRunApiResponse>(
          {
            ok: false,
            error: 'Selected tractor model was not found in the database.',
          },
          { status: 404 },
        );
      }

      if (error.message === 'SELECTED_METHOD_NOT_AVAILABLE') {
        return NextResponse.json<SaveValuationRunApiResponse>(
          {
            ok: false,
            error: 'The selected valuation method is not available for this tractor profile.',
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json<SaveValuationRunApiResponse>(
      {
        ok: false,
        error: 'Failed to save valuation run.',
      },
      { status: 500 },
    );
  }
}