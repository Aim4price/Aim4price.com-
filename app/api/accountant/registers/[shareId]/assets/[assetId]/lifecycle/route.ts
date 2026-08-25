import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../../../../lib/auth-session';
import {
  accountantWorkspaceError,
  getAccountantRegisterAccess,
} from '../../../../../../../../lib/accountant-workspace';
import { getAssetRegisterItemById } from '../../../../../../../../lib/asset-register-db';
import { disposeOrDeleteAsset, type AssetDisposalReason } from '../../../../../../../../lib/asset-lifecycle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string; assetId: string } };

export async function POST(request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  try {
    const access = await getAccountantRegisterAccess({ accountantUserId: session.user.id, shareId: context.params.shareId });
    if (!access.allowDirectUpdates) throw new Error('ACCOUNTANT_READ_ONLY');
    const asset = await getAssetRegisterItemById(access.ownerUserId, context.params.assetId);
    if (!asset) throw new Error('ACCOUNTANT_ASSET_NOT_FOUND');
    const body = await request.json() as Record<string, unknown>;
    const reason = String(body.reason ?? '') as AssetDisposalReason;
    const aim4priceOutcomeInfluence = String(body.aim4priceOutcomeInfluence ?? body.aim4priceSaleInfluence ?? '').trim().toLowerCase();
    const impactQuestionRequired = ['sold', 'traded_in', 'scrapped'].includes(reason);
    if (impactQuestionRequired && !['yes', 'no', 'unsure'].includes(aim4priceOutcomeInfluence)) {
      return NextResponse.json({ ok: false, error: 'Tell us whether Aim4price helped with this outcome.' }, { status: 400 });
    }
    const result = await disposeOrDeleteAsset({
      ownerUserId: access.ownerUserId,
      assetId: asset.id,
      reason,
      disposalDate: body.effectiveDate,
      disposalAmountExVat: body.amount,
      note: body.note,
      aim4priceOutcomeInfluence: impactQuestionRequired
        ? aim4priceOutcomeInfluence as 'yes' | 'no' | 'unsure'
        : null,
      actorUserId: session.user.id,
      actorName: access.accountantName,
      actorOrganisation: access.accountantOrganisation,
    });
    return NextResponse.json({ ok: true, mode: result.mode });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_DELETE_HAS_DEPENDENCIES') {
      return NextResponse.json({ ok: false, error: 'Move or resolve linked finance, costs, documents and accounting values before deleting this record.' }, { status: 409 });
    }
    console.error('accountant asset lifecycle POST failed', error);
    const mapped = accountantWorkspaceError(error);
    return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
  }
}
