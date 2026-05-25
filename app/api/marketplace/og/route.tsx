import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import {
  buildListingSpecLine,
  findMarketplaceShareListing,
  formatListingLocation,
  formatListingPublishedDate,
  formatListingUsage,
  formatMarketplaceSharePrice,
  getListingConditionLabel,
  getListingPrimaryFamilyLabel,
  getListingPrimaryImage,
  listingDisplayTitle,
  listingUsageLabel,
  toAbsoluteMarketplaceUrl,
} from '../../../../lib/marketplace-share';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

function fallbackResponse() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 64,
          background: '#f3f6f8',
          color: '#050505',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 800, color: '#165340', marginBottom: 18 }}>Aim4price Marketplace</div>
        <div style={{ fontSize: 62, lineHeight: 1.02, fontWeight: 900, letterSpacing: '-0.045em' }}>
          Machinery listings with clear details.
        </div>
        <div style={{ marginTop: 26, fontSize: 24, color: '#53605c' }}>
          Browse agricultural, construction and industrial machinery on Aim4price.
        </div>
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
    },
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        width: '48%',
        minHeight: 82,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '14px 18px',
        borderRadius: 18,
        background: '#f0f2f5',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#65676b',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 850, color: '#050505', lineHeight: 1.12 }}>{value}</div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  const listingReference = String(request.nextUrl.searchParams.get('listing') ?? '').trim();
  const listing = await findMarketplaceShareListing(listingReference);

  if (!listing) {
    return fallbackResponse();
  }

  const origin = request.nextUrl.origin;
  const title = listingDisplayTitle(listing);
  const price = formatMarketplaceSharePrice(listing);
  const location = formatListingLocation(listing);
  const imageUrl = toAbsoluteMarketplaceUrl(getListingPrimaryImage(listing), origin);
  const logoUrl = toAbsoluteMarketplaceUrl('/brand/Aim4price Logo.png', origin);
  const detailsLine = buildListingSpecLine(listing);
  const listedDate = formatListingPublishedDate(listing.dateAdvertised || listing.publishedAtIso);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: 34,
          background: '#eef3f1',
          color: '#050505',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: 40,
            bottom: 12,
            fontSize: 104,
            lineHeight: 1,
            fontWeight: 900,
            letterSpacing: '-0.07em',
            color: 'rgba(22, 83, 64, 0.07)',
          }}
        >
          Aim4price
        </div>

        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            overflow: 'hidden',
            borderRadius: 34,
            background: '#ffffff',
            border: '1px solid rgba(205, 216, 224, 0.95)',
          }}
        >
          <div
            style={{
              width: 550,
              height: '100%',
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'center',
              background: '#050505',
            }}
          >
            <img
              src={imageUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: '38px 44px 36px',
              background: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 }}>
              <img src={logoUrl} alt="" style={{ width: 178, height: 52, objectFit: 'contain' }} />
              <div
                style={{
                  padding: '10px 16px',
                  borderRadius: 999,
                  background: '#edf6f1',
                  color: '#165340',
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                Marketplace
              </div>
            </div>

            <div
              style={{
                fontSize: 68,
                lineHeight: 0.92,
                fontWeight: 950,
                letterSpacing: '-0.075em',
                color: '#050505',
                marginBottom: 10,
              }}
            >
              {price}
            </div>

            <div
              style={{
                fontSize: title.length > 30 ? 32 : 38,
                lineHeight: 1.1,
                fontWeight: 850,
                color: '#050505',
                marginBottom: 8,
              }}
            >
              {title}
            </div>

            <div style={{ fontSize: 21, color: '#65676b', lineHeight: 1.34, marginBottom: 22 }}>{location}</div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
              <DetailPill label="Year" value={String(listing.yearModel || 'N/A')} />
              <DetailPill label={listingUsageLabel(listing)} value={formatListingUsage(listing)} />
              <DetailPill label="Condition" value={getListingConditionLabel(listing)} />
              <DetailPill label="Family" value={getListingPrimaryFamilyLabel(listing)} />
            </div>

            <div style={{ width: '100%', height: 1, background: '#dadde1', marginBottom: 18 }} />

            <div style={{ fontSize: 23, lineHeight: 1.42, color: '#050505', fontWeight: 700 }}>
              {detailsLine || 'Machinery listing'}
            </div>
            <div style={{ marginTop: 8, fontSize: 18, lineHeight: 1.35, color: '#65676b', fontWeight: 700 }}>
              Listed {listedDate}
            </div>

            <div
              style={{
                marginTop: 'auto',
                minHeight: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
                background: '#edf6f1',
                color: '#165340',
                fontSize: 22,
                fontWeight: 850,
              }}
            >
              View this listing on Aim4price
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
    },
  );
}
