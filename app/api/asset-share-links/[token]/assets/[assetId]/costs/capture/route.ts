import type { NextRequest } from 'next/server';
import { submitSharedCostCapture } from '../../../../../../../../lib/shared-cost-capture';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,{params}:{params:{token:string;assetId:string}}) {return submitSharedCostCapture(request,params);}
