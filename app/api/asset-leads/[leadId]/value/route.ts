import type {NextRequest} from 'next/server';
import {ownerValueApi,sharedValueApi} from '../../../../../lib/asset-value-api';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(r:NextRequest,c:{params:{leadId:string}}){return sharedValueApi(r,{leadId:c.params.leadId})}
export const POST=GET;
