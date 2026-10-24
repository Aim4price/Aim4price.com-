import type {NextRequest} from 'next/server';
import {sharedMarketPrice} from '../../../../../../../lib/shared-market-price';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest,{params}:{params:{token:string;assetId:string}})=>sharedMarketPrice(request,params);
export const POST=GET;
