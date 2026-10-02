import type { NextRequest } from 'next/server';
import { saveSharedContribution, readSharedCostAsset } from '../../../../../lib/shared-asset-contributions-api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,{params}:{params:{leadId:string}}) {return saveSharedContribution(request,params,'costs');}
export async function GET(_request:NextRequest,{params}:{params:{leadId:string}}) {return readSharedCostAsset(params);}
