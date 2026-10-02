import type { NextRequest } from 'next/server';
import { saveSharedContribution } from '../../../../../lib/shared-asset-contributions-api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,{params}:{params:{leadId:string}}) {return saveSharedContribution(request,params,'costs');}
