import { NextRequest, NextResponse } from 'next/server';
import { resolveAssetRegisterUploadBytes } from '../../../../../lib/asset-register-uploads';
import {
  findMarketplaceShareListing,
  getListingPrimaryImage,
  toAbsoluteMarketplaceUrl,
} from '../../../../../lib/marketplace-share';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INTERNAL_ASSET_UPLOAD_PREFIX = '/api/asset-register/uploads/';
const SOCIAL_IMAGE_CACHE_CONTROL = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400';
const MAX_DATA_IMAGE_BYTES = 8 * 1024 * 1024;
const FALLBACK_MARKETPLACE_IMAGE = '/brand/Tractor.png';

type RouteContext = {
  params: {
    listingReference: string;
  };
};

function normalizeListingReference(value: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(String(value ?? '').trim());
    } catch {
      return String(value ?? '').trim();
    }
  })();

  return decoded.replace(/\.(?:jpe?g|png|webp)$/i, '').trim();
}

function isSupportedImageType(value: string): boolean {
  const contentType = String(value ?? '').trim().toLowerCase();
  return contentType === 'image/jpeg' || contentType === 'image/png' || contentType === 'image/webp';
}

function socialImageHeaders(contentType: string, contentLength?: number): HeadersInit {
  return {
    'Content-Type': contentType,
    ...(typeof contentLength === 'number' ? { 'Content-Length': String(contentLength) } : {}),
    'Cache-Control': SOCIAL_IMAGE_CACHE_CONTROL,
    'Content-Disposition': 'inline',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  };
}

function fallbackImageRedirect(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(FALLBACK_MARKETPLACE_IMAGE, request.nextUrl.origin), {
    status: 302,
    headers: {
      'Cache-Control': SOCIAL_IMAGE_CACHE_CONTROL,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function safeRedirectToImage(request: NextRequest, imageUrl: string): NextResponse {
  const absoluteUrl = toAbsoluteMarketplaceUrl(imageUrl, request.nextUrl.origin);

  if (!/^https?:\/\//i.test(absoluteUrl)) {
    return fallbackImageRedirect(request);
  }

  return NextResponse.redirect(absoluteUrl, {
    status: 302,
    headers: {
      'Cache-Control': SOCIAL_IMAGE_CACHE_CONTROL,
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function dataImageResponse(value: string): NextResponse | null {
  const match = String(value ?? '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-z0-9+/=\s]+)$/i);

  if (!match) {
    return null;
  }

  const contentType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');

  if (!buffer.length || buffer.length > MAX_DATA_IMAGE_BYTES) {
    return null;
  }

  return new NextResponse(buffer, {
    status: 200,
    headers: socialImageHeaders(contentType, buffer.length),
  });
}

async function internalUploadImageResponse(imageUrl: string): Promise<NextResponse | null> {
  if (!String(imageUrl ?? '').includes(INTERNAL_ASSET_UPLOAD_PREFIX)) {
    return null;
  }

  const uploadResult = await resolveAssetRegisterUploadBytes(imageUrl);

  if (uploadResult.status === 'unavailable') {
    return new NextResponse('Image temporarily unavailable', {
      status: 503,
      headers: {
        'Cache-Control': 'private, no-store',
        'Retry-After': '60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const upload = uploadResult.status === 'ready' ? uploadResult.upload : null;

  if (!upload || !isSupportedImageType(upload.mimeType)) {
    return null;
  }

  return new NextResponse(upload.data, {
    status: 200,
    headers: socialImageHeaders(upload.mimeType, upload.data.length),
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const listingReference = normalizeListingReference(context.params?.listingReference ?? '');
  const listing = await findMarketplaceShareListing(listingReference);

  if (!listing) {
    return fallbackImageRedirect(request);
  }

  const imageUrl = getListingPrimaryImage(listing);

  if (!imageUrl) {
    return fallbackImageRedirect(request);
  }

  const internalUploadResponse = await internalUploadImageResponse(imageUrl);

  if (internalUploadResponse) {
    return internalUploadResponse;
  }

  const inlineDataResponse = dataImageResponse(imageUrl);

  if (inlineDataResponse) {
    return inlineDataResponse;
  }

  return safeRedirectToImage(request, imageUrl);
}
