import type { NextRequest } from 'next/server';
import { sharedAssetDocuments } from '../../../../../../../lib/shared-asset-documents';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:{token:string;assetId:string}}){return sharedAssetDocuments(request,params);}
export const POST=GET;
