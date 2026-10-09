import type {NextRequest} from 'next/server';
import {assetPartsRequest} from '../../../../../lib/asset-parts-api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest,{params}:{params:{leadId:string}})=>assetPartsRequest(request,params);
export const POST=GET;
