import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { getAssetLeadLogoForUser } from '../../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_IMAGE_PATTERN = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([a-z0-9+/=\s]+)$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } },
) {
  const session = await getServerSession({ allowDealerApp: true, allowOwnerApp: true });

  if (!session?.user?.id) {
    return new NextResponse(null, { status: 401 });
  }

  const leadId = String(params.leadId ?? '').trim();
  if (!UUID_PATTERN.test(leadId)) {
    return new NextResponse(null, { status: 404 });
  }

  const logoUrl = await getAssetLeadLogoForUser({
    currentUserId: session.user.id,
    leadId,
  });

  if (!logoUrl) {
    return new NextResponse(null, { status: 404 });
  }

  const dataImage = logoUrl.match(DATA_IMAGE_PATTERN);
  if (dataImage) {
    const bytes = new Uint8Array(Buffer.from(dataImage[2].replace(/\s+/g, ''), 'base64'));
    return new NextResponse(bytes, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'Content-Type': dataImage[1].toLowerCase(),
        'Content-Length': String(bytes.byteLength),
      },
    });
  }

  if (logoUrl.startsWith('/') || /^https?:\/\//i.test(logoUrl)) {
    return NextResponse.redirect(new URL(logoUrl, request.url), 307);
  }

  return new NextResponse(null, { status: 404 });
}
