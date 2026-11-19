import { NextRequest, NextResponse } from 'next/server';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { getAnyServerSession } from '../../../../lib/auth-session';
import { isAim4priceAdminEmail } from '../../../../lib/account-constants';
import { saveAssetOption, importAssetOptionsCsv, OptionError } from '../../../../lib/asset-options-db';

export async function PUT(request: NextRequest) {
  const session = await getAnyServerSession();
  if (!session?.user?.id || !isAim4priceAdminEmail(session.user.email))
    return NextResponse.json({error:'Admin access required.'}, {status:403});
  if (!isTrustedRequestOrigin(request.headers.get('origin'), new URL(request.url).origin))
    return NextResponse.json({error:'Invalid request origin.'}, {status:403});
  try {
    if (request.headers.get('content-type')?.split(';')[0] === 'text/csv') {
      const csv = await request.text();
      return NextResponse.json(await importAssetOptionsCsv(csv));
    }
    return NextResponse.json({option: await saveAssetOption(await request.json())});
  } catch (error) {
    return NextResponse.json({error: error instanceof OptionError ? error.message : 'Could not save the asset option.'},
      {status: error instanceof OptionError ? error.status : 400});
  }
}
