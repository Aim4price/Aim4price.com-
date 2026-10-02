import type { NextRequest } from 'next/server';
import { sharedCaptureAllowance } from '../../../../../../lib/shared-cost-capture';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:{leadId:string}}) {return sharedCaptureAllowance(request,params);}
export async function POST(request:NextRequest,{params}:{params:{leadId:string}}) {return sharedCaptureAllowance(request,params);}
