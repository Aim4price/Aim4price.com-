import type { NextRequest } from 'next/server';
import { businessBody, businessJson, requireBusinessOrigin } from '../../../../lib/business-network-api';
import { validCurrentSaleabilityAnswers } from '../../../../lib/asset-saleability';
import { quoteSaleability } from '../../../../lib/server/saleability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public, unsaved estimates remain available to guests. Saved assets use the
// authenticated asset-register endpoint, which loads the authoritative value.
export async function POST(request: NextRequest) {
  try { requireBusinessOrigin(request); } catch {
    return businessJson({ error: 'This request must be sent from Aim4price.' }, 403);
  }
  try {
    const body = await businessBody(request);
    if (typeof body.valuationExVat !== 'number' || !validCurrentSaleabilityAnswers(body.answers)) {
      return businessJson({ error: 'Complete the selling questions.' }, 400);
    }
    const context = body.context;
    if (!context || typeof context !== 'object' || Array.isArray(context)) return businessJson({ error: 'Invalid asset type.' }, 400);
    const fields = context as Record<string, unknown>;
    if (Object.values(fields).some(v => typeof v !== 'string' || v.length > 150)) return businessJson({ error: 'Invalid asset type.' }, 400);
    const quote = quoteSaleability(body.valuationExVat, body.answers, {
      kind: fields.kind as string | undefined,
      sectorKey: fields.sectorKey as string | undefined,
      familyKey: fields.familyKey as string | undefined,
    });
    return businessJson({ quote });
  } catch {
    return businessJson({ error: 'Could not calculate. Check the asset value and try again.' }, 400);
  }
}
