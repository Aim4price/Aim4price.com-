import type {NextRequest} from 'next/server';
import {sharedAssetProblems} from '../../../../../lib/shared-asset-problems';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=(request:NextRequest,{params}:{params:{leadId:string}})=>sharedAssetProblems(request,params);
export const POST=GET;
